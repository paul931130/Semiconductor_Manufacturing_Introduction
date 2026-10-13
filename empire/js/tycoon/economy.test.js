// node js/tycoon/economy.test.js  （於 empire/ 目錄下，或任何位置皆可）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as E from './economy.js';
import { nextRandom, mulberry32 } from '../shared/rng.js';
import { migrate, SAVE_VERSION } from '../shared/storage.js';
import { runGreedy, loadEvents } from './headless.js';
import * as S from './state.js';
import * as Sim from './sim.js';
import { setEventDefs } from './events.js';
import { bus } from '../shared/bus.js';
import { operatingAdvice } from './advisor.js';

const bal = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/balance.json', import.meta.url)), 'utf8'));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} expected ${b}, got ${a}`);

const slotsF1 = (equips, level = 1) => equips.map(e => ({ equip: e, level }));
// 範例用「defMul = 1」的機台集合：pvd_sputter(1.00) / coater_developer(1.00) / etch_chamber(1.00)；清洗無 1.00 機台，
// 所以範例以直接覆寫 defMul 的 bal 副本計算，與 DESIGN 範例（「4 槽皆 L1、defMul=1」）一致。
const balUnit = JSON.parse(JSON.stringify(bal));
for (const k of Object.keys(balUnit.equipment)) balUnit.equipment[k].defMul = 1;

t('§3.4 範例 1：f1 四槽 L1、defMul=1、S=0 → y=0.95, Y=0.95^4≈0.815（D0、L1 不受再平衡影響）', () => {
  const s = slotsF1(['wet_bench', 'pvd_sputter', 'coater_developer', 'etch_chamber']);
  near(E.slotYield(balUnit, 'f1', 'etch_chamber', 1, 0), 0.95, 1e-12, 'y');
  near(E.lineYield(balUnit, 'f1', s, 0), 0.8145, 1e-4, 'Y');
  assert.equal(E.lineYield(balUnit, 'f1', s, 0).toFixed(3), '0.815');
});

t('§3.4 範例 2（v2 再平衡 levelFactor=0.72）：全 L5 且 S=1 → d=0.05×0.72⁴×0.5≈0.00672, Y≈0.973', () => {
  const s = slotsF1(['wet_bench', 'pvd_sputter', 'coater_developer', 'etch_chamber'], 5);
  const d = 0.05 * Math.pow(bal.yield.levelFactor, 4) * 0.5;
  near(E.slotDefect(balUnit, 'f1', 'etch_chamber', 5, 1), d, 1e-12, 'd');
  const Y = E.lineYield(balUnit, 'f1', s, 1);
  near(Y, Math.pow(1 - d, 4), 1e-12);
  assert.equal(Y.toFixed(2), '0.97');
});

t('單槽良率 d 上限 0.5；線良率夾在 [0.05, 0.99]', () => {
  assert.equal(E.slotYield(balUnit, 'f5', 'etch_chamber', 1, 0, 100), 0.5);
  const many = Array(60).fill({ equip: 'etch_chamber', level: 1 });
  assert.equal(E.lineYield(balUnit, 'f5', many, 0), 0.05);
  assert.equal(E.lineYield(balUnit, 'f1', slotsF1(['etch_chamber'], 5), 1, { E: 5 }), 0.99);
});

t('事件缺陷加算：particle eventDef=0.5 → d×1.5', () => {
  const d0 = E.slotDefect(bal, 'f2', 'cvd_chamber', 3, 0.4, 0);
  near(E.slotDefect(bal, 'f2', 'cvd_chamber', 3, 0.4, 0.5), d0 * 1.5, 1e-12);
});

t('盈虧平衡良率 0.60/0.52/0.46/0.42/0.38 與標稱毛利 40/48/54/58/62%（v2：成本 ×1.2）', () => {
  const be = bal.fabOrder.map(f => E.breakEvenYield(bal, f).toFixed(2));
  assert.deepEqual(be, ['0.60', '0.52', '0.46', '0.42', '0.38']);
  const mg = bal.fabOrder.map(f => Math.round(E.nominalMargin(bal, f) * 100));
  assert.deepEqual(mg, [40, 48, 54, 58, 62]);
});

t('廠倍率 [1,2,4,10,25]、機台價與升級費 = price×倍率×1.5^L', () => {
  assert.deepEqual(bal.fabOrder.map(f => E.fabMult(bal, f)), [1, 2, 4, 10, 25]);
  assert.equal(E.equipPrice(bal, 'f1', 'wet_bench'), 600);
  assert.equal(E.equipPrice(bal, 'f4', 'scanner'), 25000);
  assert.equal(E.upgradeCost(bal, 'f1', 'wet_bench', 1), 900);
  assert.equal(E.upgradeCost(bal, 'f3', 'cmp_tool', 2), Math.round(1100 * 4 * 2.25));
  assert.equal(E.sellRefund(bal, 3000), 1500);
});

t('槽位時間 p = 4/(speed×(1+0.25(L−1)))；線速度 = max p', () => {
  near(E.slotHours(bal, 'wet_bench', 1), 4 / 1.2, 1e-12);
  near(E.slotHours(bal, 'furnace', 5), 4 / (1.3 * 2), 1e-12);
  const h = ['wet_bench', 'furnace', 'coater_developer', 'etch_chamber'].map(e => E.slotHours(bal, e, 1));
  near(E.lineInterval(h), 4 / 0.9, 1e-12); // 微影 coater speed 0.9 為最慢
  assert.equal(E.lineInterval([1, null, 2]), null);
});

t('槽位可選機台：f1–f3 微影=coater_developer，f4–f5 微影=scanner（含 f5 槽 8）', () => {
  assert.deepEqual(E.allowedEquip(bal, 'f1', 2), ['coater_developer']);
  assert.deepEqual(E.allowedEquip(bal, 'f3', 2), ['coater_developer']);
  assert.deepEqual(E.allowedEquip(bal, 'f4', 2), ['scanner']);
  assert.deepEqual(E.allowedEquip(bal, 'f5', 7), ['scanner']);
  assert.deepEqual(E.allowedEquip(bal, 'f1', 0), ['wet_bench', 'single_wafer_cleaner']);
  assert.equal(bal.fabs.f5.slots.length, 8);
  assert.deepEqual(bal.fabOrder.map(f => bal.fabs[f].slots.length), [4, 5, 6, 7, 8]);
});

t('售價 = 基準 × (0.9+0.2·rep/100) × 波動；聲望增量 (Y−0.75)×2', () => {
  near(E.sellPrice(bal, 'f1', 20, 1), 60 * 0.94, 1e-12);
  near(E.sellPrice(bal, 'f2', 100, 1.1), 115 * 1.1 * 1.1, 1e-12);
  near(E.repGain(bal, 0.815), 0.13, 1e-12);
  assert.ok(E.repGain(bal, 0.5) < 0);
});

t('價格指數：均值回歸、限 0.7–1.4；需求指數限 0.6–1.4', () => {
  let w = 1;
  for (let i = 0; i < 500; i++) w = E.nextPriceWalk(bal, w, 1);
  assert.equal(w, bal.market.priceMax);
  for (let i = 0; i < 500; i++) w = E.nextPriceWalk(bal, w, 0);
  assert.equal(w, bal.market.priceMin);
  near(E.nextPriceWalk(bal, 1.3, 0.5), 1.3 + bal.market.revert * (1 - 1.3), 1e-12); // 無隨機項 → 往 1 回歸
  assert.equal(E.nextPriceWalk(bal, 1, 0.5, 5), bal.market.priceMax);
  let d = 1; for (let i = 0; i < 300; i++) d = E.nextDemand(bal, d, 1);
  assert.equal(d, bal.market.demandMax);
  assert.equal(E.dailyDemand(bal, 1), bal.demandCap);
});

t('庫存：新鮮度、庫齡合併、倉儲費', () => {
  assert.equal(E.freshness(bal, 0), 1);
  near(E.freshness(bal, 5), 1 - 5 * bal.market.ageDecay, 1e-12);
  assert.equal(E.freshness(bal, 999), bal.market.ageFloor);
  near(E.mergeAge(4, 100, 100), 2, 1e-12);
  assert.equal(E.mergeAge(3, 0, 0), 0);
  near(E.holdCost(bal, 'f1', 100), 100 * bal.fabs.f1.cost * bal.market.holdRate, 1e-9);
});

t('賣出營收：賣越多單價越低；舊庫存打折；可賣量 = 需求 − 已賣', () => {
  const D = 100;
  const one = E.sellRevenue(bal, 'f1', 20, 1, D, 0, 1, 0);
  near(one, E.sellPrice(bal, 'f1', 20, 1) * (1 - bal.market.slip * 0.5 / D), 1e-9);
  const half = E.sellRevenue(bal, 'f1', 20, 1, D, 0, 50, 0), all = E.sellRevenue(bal, 'f1', 20, 1, D, 0, 100, 0);
  assert.ok(all / 100 < half / 50, '平均單價隨賣量下降');
  near(E.sellRevenue(bal, 'f1', 20, 1, D, 0, 50, 0) + E.sellRevenue(bal, 'f1', 20, 1, D, 50, 50, 0), all, 1e-9); // 分兩次 = 一次
  assert.ok(E.sellRevenue(bal, 'f1', 20, 1, D, 0, 50, 5) < half);
  assert.equal(E.sellRevenue(bal, 'f1', 20, 1, D, 0, 0, 0), 0);
  assert.equal(E.sellRoom(100, 30), 70); assert.equal(E.sellRoom(100, 130), 0);
});

t('產線轉速：製程時間 ÷ rate、缺陷 × (1 + k(rate−1))；1.0 為中性', () => {
  const m1 = E.rateMods(bal, 1); assert.equal(m1.pMul, 1); assert.equal(m1.defMul, 1);
  const m14 = E.rateMods(bal, 1.4);
  near(m14.pMul, 1 / 1.4, 1e-12); near(m14.defMul, 1 + bal.rate.defect * 0.4, 1e-12);
  assert.ok(E.rateMods(bal, 0.7).defMul < 1);
  assert.equal(E.rateMods(bal, 99).pMul, 1 / bal.rate.max);
});

t('瓶頸：處理時間最長的槽（同分取前）；不通回 -1', () => {
  assert.equal(E.bottleneckIndex([3, 4, 2, 4]), 1);
  assert.equal(E.bottleneckIndex([3, null, 2]), -1);
  const fab = { slots: slotsF1(['wet_bench', 'furnace', 'coater_developer', 'etch_chamber']) };
  assert.equal(E.fabStats(bal, 'f1', fab, 0).bottleneck, 2);
  fab.slots[2].level = 5; // 升級瓶頸 → 瓶頸移到 etch_chamber
  assert.equal(E.fabStats(bal, 'f1', fab, 0).bottleneck, 3);
});

t('升級前後對照：升級瓶頸 → 產能與利潤上升；升級非瓶頸 → 只升良率', () => {
  const mk = lv => ({ slots: ['wet_bench', 'furnace', 'coater_developer', 'etch_chamber'].map((e, i) => ({ equip: e, level: lv[i] })) });
  const base = [1, 1, 1, 2]; // 蝕刻 L2 → 3.2 時，微影 4.4 時是唯一瓶頸
  const a = E.lineProjection(bal, 'f1', mk(base), 0, {}, 20, 1, 1);
  const up = i => { const l = [...base]; l[i] += 1; return E.lineProjection(bal, 'f1', mk(l), 0, {}, 20, 1, 1); };
  assert.equal(a.bottleneck, 2);
  const bn = up(2), nb = up(3);
  assert.ok(bn.wafersPerDay > a.wafersPerDay && bn.Y > a.Y && bn.profitPerDay > a.profitPerDay);
  assert.equal(nb.wafersPerDay, a.wafersPerDay); // 蝕刻不是瓶頸：產能不變
  assert.ok(nb.Y > a.Y);
  assert.ok(Math.abs(a.profitPerDay - (a.revenue - a.startCost - a.maintenance)) < 1e-9);
  const sat = E.lineProjection(bal, 'f1', mk([5, 5, 5, 5]), 1, {}, 20, 1, 0.6); // 需求飽和：銷量被需求卡住
  assert.ok(sat.saturated && sat.sold === sat.demand);
});

t('並列瓶頸：只升一槽產能不變，兩槽一起升才變快；瓶頸集合與升級前後一致', () => {
  const mk = lv => ({ slots: ['wet_bench', 'furnace', 'coater_developer', 'etch_chamber'].map((e, i) => ({ equip: e, level: lv[i] })) });
  const a = E.lineProjection(bal, 'f1', mk([1, 1, 1, 1]), 0);
  assert.deepEqual(a.bottlenecks, [2]);
  const up = E.lineProjection(bal, 'f1', mk([1, 1, 2, 1]), 0);
  assert.ok(up.wafersPerDay > a.wafersPerDay * 1.1, '升級唯一瓶頸必須明顯增加產能');
  const sl = (...l) => ({ slots: [['wet_bench', 1], ['furnace', 1], ['etch_chamber', l[0]], ['etch_chamber', l[1]]].map(([equip, level]) => ({ equip, level })) });
  const tie = E.fabStats(bal, 'f1', sl(1, 1), 0), one = E.fabStats(bal, 'f1', sl(2, 1), 0);
  assert.deepEqual(tie.bottlenecks, [2, 3]);
  assert.equal(one.wafersPerDay, tie.wafersPerDay); // 只升並列的一槽：產能不變
  assert.deepEqual(one.bottlenecks, [3]);
});

t('升級瓶頸回本：f1 最便宜四機、轉速 ×0.7，約 10–20 日', () => {
  const m = E.rateMods(bal, 0.7), mods = { pMul: m.pMul, eventDef: m.defMul - 1 };
  const eq = ['wet_bench', 'furnace', 'coater_developer', 'etch_chamber'];
  const mk = lv => ({ slots: eq.map((e, i) => ({ equip: e, level: lv[i] })) });
  const a = E.lineProjection(bal, 'f1', mk([1, 1, 1, 1]), 0, mods, 20);
  const b = E.lineProjection(bal, 'f1', mk([1, 1, 2, 1]), 0, mods, 20);
  const pb = E.upgradeCost(bal, 'f1', 'coater_developer', 1) / (b.profitPerDay - a.profitPerDay);
  console.log('   bottleneck upgrade: cost', E.upgradeCost(bal, 'f1', 'coater_developer', 1), '| wafers/day', Math.round(a.wafersPerDay), '->', Math.round(b.wafersPerDay), '| profit/day', Math.round(a.profitPerDay), '->', Math.round(b.profitPerDay), '| payback', pb.toFixed(1), 'days');
  assert.ok(pb >= 8 && pb <= 20);
});

t('實際投片節奏 ≈ 投影產能（投片間隔保留小數餘量，不被 tick 取整吃掉）', () => {
  const b2 = JSON.parse(JSON.stringify(bal)); b2.events.dailyChance = 0;
  setEventDefs(loadEvents());
  S.initState(b2, { fresh: true });
  const st = S.getState();
  ['wet_bench', 'furnace', 'coater_developer', 'etch_chamber'].forEach((e, i) => { st.fabs.f1.slots[i] = { equip: e, level: 1, invested: 0 }; });
  st.res.money = 1e8; st.fabs.f1.rate = 0.7;
  let started = 0; const off = bus.on('lot:started', () => started++);
  const days = 30;
  for (let i = 0; i < days * bal.ticksPerDay; i++) { st.res.inv.f1 = 0; Sim.stepTick(); }
  if (typeof off === 'function') off();
  const want = Sim.fabStatsNow('f1').lotsPerDay * days;
  assert.ok(Math.abs(started - want) / want < 0.04, `started ${started} vs ${want.toFixed(1)}`);
});

t('訂單：多數貼近現況良率，挑戰單明確標示且高於現況', () => {
  const hi = E.makeContract(bal, 'f1', 20, 0.83, [0.5, 0.5, 1, 0.5, 0.9], 1, 0);
  const lo = E.makeContract(bal, 'f1', 20, 0.83, [0.5, 0.5, 0, 0.5, 0.9], 1, 0);
  assert.ok(!hi.stretch && hi.minY <= 0.83 + bal.contracts.yieldMax + 0.006 && lo.minY >= 0.83 + bal.contracts.yieldMin - 0.006);
  const st = E.makeContract(bal, 'f1', 20, 0.83, [0.5, 0.5, 0, 0.5, 0.05], 1, 0);
  assert.ok(st.stretch && st.minY > 0.83);
});

t('轉速各有適用情境：行情差慢速、標準行情＋需求會飽和用標準、行情好用快速', () => {
  const eq = ['wet_bench', 'furnace', 'coater_developer', 'etch_chamber'];
  const mk = lv => ({ slots: eq.map((e, i) => ({ equip: e, level: lv[i] })) });
  const best = (lv, walk, dem) => {
    let bi = 0, bv = -1e18;
    bal.rate.steps.forEach((r, i) => { const m = E.rateMods(bal, r); const p = E.lineProjection(bal, 'f1', mk(lv), 0, { pMul: m.pMul, eventDef: m.defMul - 1 }, 20, walk, dem).profitPerDay; if (p > bv) { bv = p; bi = i; } });
    return bal.rate.steps[bi];
  };
  assert.equal(best([1, 1, 1, 1], 0.8, 0.8), 0.7);
  assert.equal(best([3, 3, 3, 3], 1, 1), 1.0);
  assert.ok(best([1, 1, 1, 1], 1.3, 1.3) >= 1.2);
});

t('客戶訂單：數量、單價溢價、良率門檻、違約金', () => {
  const c = E.makeContract(bal, 'f1', 20, 0.8, [0, 0, 0, 0, 0.9], 7, 10);
  assert.equal(c.id, 7); assert.equal(c.deadline, null); assert.equal(c.offerEnd, 10 + bal.contracts.offerDays);
  assert.equal(c.qty % 5, 0);
  near(c.unitPrice, Math.round(E.sellPrice(bal, 'f1', 20, 1) * bal.contracts.premMin * 100) / 100, 0.01);
  near(c.minY, 0.8 + bal.contracts.yieldMin, 0.01); assert.equal(c.stretch, false);
  assert.equal(c.days, bal.contracts.daysMin);
  const hi = E.makeContract(bal, 'f1', 20, 0.99, [0.999, 0.999, 0.999, 0.999, 0.999], 8, 0);
  assert.equal(hi.minY, 0.97); assert.equal(hi.days, bal.contracts.daysMax);
  assert.ok(hi.unitPrice > E.sellPrice(bal, 'f1', 20, 1));
  assert.equal(E.contractPayout(c), Math.round(c.qty * c.unitPrice));
  assert.equal(c.penalty, Math.round(c.qty * c.unitPrice * bal.contracts.penaltyFrac));
});

t('星數比 S 與解鎖條件', () => {
  assert.equal(E.starRatio(bal, 'f2', { 'f2-1': 3, 'f2-2': 3, 'f2-3': 3, 'f2-4': 3 }), 1);
  near(E.starRatio(bal, 'f1', { 'f1-1': 3, 'f1-2': 2 }), 5 / 9, 1e-12);
  assert.equal(E.starRatio(bal, 'f3', {}), 0);
  const u = E.unlockStatus(bal, 'f2', { money: bal.fabs.f2.unlockMoney, rep: 15, stars: { 'f2-1': 1, 'f2-2': 1, 'f2-3': 1, 'f2-4': 1 } });
  assert.ok(u.all);
  assert.ok(!E.unlockStatus(bal, 'f2', { money: bal.fabs.f2.unlockMoney - 1, rep: 15, stars: { 'f2-1': 1, 'f2-2': 1, 'f2-3': 1, 'f2-4': 1 } }).all);
  assert.ok(!E.unlockStatus(bal, 'f2', { money: 99999, rep: 99, stars: { 'f2-1': 1 } }).all);
});

t('fabStats：f1 預設最便宜配置的日產能', () => {
  const fab = { slots: slotsF1(['wet_bench', 'furnace', 'coater_developer', 'etch_chamber']) };
  const st = E.fabStats(bal, 'f1', fab, 0, {}, 20, 1);
  near(st.interval, 4 / 0.9, 1e-9);
  near(st.lotsPerDay, 24 * 0.9 / 4, 1e-9);
  near(st.wafersPerDay, 135, 1e-9);
  assert.ok(st.complete);
});

t('時鐘：2× 速度下一日 ≈ 3 秒', () => {
  assert.equal(bal.tickMs['2'] * bal.ticksPerDay, 3000);
  assert.equal(bal.tickMs['1'] * bal.ticksPerDay, 6000);
});

t('PRNG：同種子可重現，值域 [0,1)；存檔 migrate 拒讀新版', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
  const rs = { seed: 7 }; const first = nextRandom(rs); assert.notEqual(rs.seed, 7); assert.ok(first >= 0 && first < 1);
  assert.equal(migrate({ version: SAVE_VERSION + 1 }).ok, false);
  assert.equal(migrate({ version: SAVE_VERSION + 1 }).reason, 'too-new');
  assert.equal(migrate({ version: SAVE_VERSION, a: 1 }).ok, true);
  assert.equal(migrate({}).ok, false);
});

t('存檔 v1 → v3 migration（經 v2）：補上市場／訂單／轉速／狀態欄位並保留原資料', () => {
  assert.equal(SAVE_VERSION, 3);
  const v1 = { version: 1, clock: { tick: 24 * 12, speed: 1, paused: true }, rng: { seed: 5 },
    res: { money: 777, rep: 33, inv: { f1: 40, f2: 0, f3: 0, f4: 0, f5: 0 }, priceWalk: 1.05, repAcc: 0 },
    fabs: { f1: { unlocked: true, slots: [null, null, null, null], ups: false, lots: [], event: null, halt: 0, feed: 999 } } };
  const r = migrate(v1);
  assert.ok(r.ok); assert.equal(r.save.version, 3);
  assert.equal(r.save.res.money, 777); assert.equal(r.save.res.inv.f1, 40);
  assert.equal(r.save.res.demandIdx, 1);
  assert.deepEqual(Object.keys(r.save.res.invAge), ['f1', 'f2', 'f3', 'f4', 'f5']);
  assert.deepEqual(r.save.res.priceHist, [1.05]);
  assert.deepEqual(r.save.res.contracts.offers, []); assert.equal(r.save.res.contracts.nextOfferDay, 15);
  assert.equal(r.save.fabs.f1.rate, 1);
  assert.equal(r.save.fabs.f1.mode, 'run'); assert.deepEqual(r.save.res.loans, []);
  assert.equal(migrate(r.save).ok, true); // v3 存檔直接通過
  assert.equal(v1.version, 1);            // 不改動原物件
});

// ---------- v3：產線狀態、貸款、緊急出清、自動化、斷鏈 ----------
function fresh3({ money = 1e6, fabs = ['f1'] } = {}) {
  const b2 = JSON.parse(JSON.stringify(bal)); b2.events.dailyChance = 0;
  setEventDefs(loadEvents());
  S.initState(b2, { fresh: true });
  Sim.resetSim();
  const st = S.getState();
  st.rng.seed = 99; st.tutorial.done.push('t-event');
  for (const f of fabs) {
    st.fabs[f].unlocked = true;
    st.fabs[f].slots.forEach((_, i) => {
      const e = E.allowedEquip(b2, f, i)[0];
      st.fabs[f].slots[i] = { equip: e, level: 1, invested: E.equipPrice(b2, f, e) };
    });
  }
  st.res.money = money;
  return { st, b: b2 };
}
const ticks = n => { for (let i = 0; i < n; i++) Sim.stepTick(); };
const count = (ev, fn) => { let c = 0; const off = bus.on(ev, () => c++); fn(); if (typeof off === 'function') off(); return c; };

t('v3 狀態維運倍率：運轉／只做完 ×1、暫停 ×0.3、封存 ×0.1，且實際一日扣款一致', () => {
  assert.equal(E.fabUpkeep(bal, 'f1', 'run'), 250); assert.equal(E.fabUpkeep(bal, 'f1', 'drain'), 250);
  assert.equal(E.fabUpkeep(bal, 'f1', 'pause'), 75); assert.equal(E.fabUpkeep(bal, 'f1', 'mothball'), 25);
  assert.equal(E.fabUpkeep(bal, 'f4', 'pause'), Math.round(4500 * 0.3));
  for (const [mode, fee] of [['pause', 75], ['mothball', 25]]) {
    const { st } = fresh3({ money: 5000 });
    assert.ok(S.setMode('f1', mode).ok);
    ticks(24);
    assert.equal(st.res.money, 5000 - fee, mode); // 沒有投片、沒有庫存 → 只有維運費
  }
});

t('v3 只做完在製品：不再投新 Lot，在製品照常出貨進庫存，清空時通知', () => {
  const { st } = fresh3();
  ticks(30);
  assert.ok(st.fabs.f1.lots.length > 0);
  assert.ok(S.setMode('f1', 'drain').ok);
  let drained = 0; const off = bus.on('fab:drained', () => drained++);
  const started = count('lot:started', () => ticks(24 * 3));
  if (typeof off === 'function') off();
  assert.equal(started, 0);
  assert.equal(st.fabs.f1.lots.length, 0);
  assert.ok(st.res.inv.f1 > 0, '在製品出貨成庫存');
  assert.equal(drained, 1);
  assert.ok(S.setMode('f1', 'run').ok);
  assert.ok(count('lot:started', () => ticks(12)) > 0, '切回運轉後恢復投片');
});

t('v3 暫停：在製品完全凍結（位置不動、不出貨、不投片），解除後繼續', () => {
  const { st } = fresh3();
  ticks(30); st.res.inv.f1 = 0;
  const snap = JSON.stringify(st.fabs.f1.lots);
  assert.ok(st.fabs.f1.lots.length > 0);
  S.setMode('f1', 'pause');
  const started = count('lot:started', () => ticks(48));
  assert.equal(started, 0);
  assert.equal(JSON.stringify(st.fabs.f1.lots), snap);
  assert.equal(st.res.inv.f1, 0);
  S.setMode('f1', 'run');
  ticks(12);
  assert.notEqual(JSON.stringify(st.fabs.f1.lots), snap);
});

t('v3 停機封存：有在製品需確認並報廢；封存不投片；重啟付費並暖機約 1 日', () => {
  const { st } = fresh3();
  ticks(30);
  const n = st.fabs.f1.lots.length; assert.ok(n > 0);
  const r0 = S.setMode('f1', 'mothball');
  assert.ok(!r0.ok && r0.needConfirm && r0.scrap === n); assert.equal(st.fabs.f1.lots.length, n); // 沒確認 → 什麼都沒變
  const r1 = S.setMode('f1', 'mothball', { confirmScrap: true });
  assert.ok(r1.ok && r1.scrapped === n); assert.equal(st.fabs.f1.lots.length, 0);
  assert.ok(!S.setMode('f1', 'pause').ok, '封存中不能直接改暫停');
  assert.equal(count('lot:started', () => ticks(48)), 0);
  const cost = E.restartCost(bal, 'f1'); assert.equal(cost, 500);
  st.res.money = cost - 1; assert.ok(!S.setMode('f1', 'run').ok);
  st.res.money = 10000; const m0 = st.res.money;
  assert.ok(S.setMode('f1', 'run').ok); assert.equal(st.res.money, m0 - cost); assert.equal(st.fabs.f1.ramp, bal.mode.rampTicks);
  assert.equal(count('lot:started', () => ticks(bal.mode.rampTicks - 2)), 0, '暖機中不投片');
  assert.ok(count('lot:started', () => ticks(30)) > 0, '暖機後恢復投片');
  // 空線封存不需確認
  S.setMode('f1', 'drain'); ticks(24 * 3); assert.equal(st.fabs.f1.lots.length, 0);
  assert.ok(S.setMode('f1', 'mothball').ok);
});

t('v3 貸款：額度 = (基本+聲望×係數)×最高開通廠倍率；日利率；隨時可還；超額被拒', () => {
  const { st } = fresh3({ money: 1000 });
  S.setMode('f1', 'pause'); // 排除投片影響
  assert.equal(E.creditLimit(bal, 20, ['f1']), 4000);
  assert.equal(E.creditLimit(bal, 20, ['f1', 'f2']), 8000);
  assert.ok(E.creditLimit(bal, 50, ['f1']) > E.creditLimit(bal, 20, ['f1']));
  assert.ok(!S.takeLoan(5000).ok); assert.ok(!S.takeLoan(300).ok);
  const r = S.takeLoan(2000);
  assert.ok(r.ok); assert.equal(st.res.money, 3000); assert.equal(S.loanAvailable(), 2000);
  assert.equal(r.loan.dueDay, 0 + bal.loan.termDays);
  ticks(24); // 一日：利息 = 本金 × 1.2% = 24（累加到欠款，不扣現金）
  assert.equal(st.res.loans[0].owed, 2024); assert.equal(st.res.money, 3000 - 75);
  assert.ok(S.repayLoan(500).ok); assert.equal(S.loanOwed(), 1524);
  assert.equal(st.res.loans[0].principal, 1524, '還款後本金 ≤ 欠款，利息隨之下降');
  st.res.money = 10000;
  assert.ok(S.repayLoan(1e9).ok); assert.equal(st.res.loans.length, 0); assert.equal(S.loanOwed(), 0);
  assert.ok(!S.repayLoan(100).ok);
});

t('v3 貸款逾期：聲望懲罰、不能再借、利率加倍，還清後恢復', () => {
  const { st } = fresh3({ money: 50000 });
  S.setMode('f1', 'pause');
  S.takeLoan(2000);
  let overdue = 0; const off = bus.on('loan:overdue', () => overdue++);
  const rep0 = st.res.rep;
  ticks(24 * (bal.loan.termDays - 1)); assert.ok(!st.res.loans[0].overdue);
  ticks(24); // 第 termDays 日結算 → 逾期
  if (typeof off === 'function') off();
  assert.equal(overdue, 1); assert.ok(st.res.loans[0].overdue);
  near(st.res.rep, rep0 - bal.loan.overdueRep, 1e-9, 'rep');
  assert.equal(S.loanAvailable(), 0); assert.ok(!S.takeLoan(500).ok);
  const before = st.res.loans[0].owed;
  ticks(24);
  assert.equal(st.res.loans[0].owed - before, Math.round(2000 * bal.loan.overdueRate)); // 逾期利率
  near(st.res.rep, rep0 - bal.loan.overdueRep - bal.loan.overdueDailyRep, 1e-9);
  S.repayLoan(1e9);
  assert.ok(S.loanAvailable() > 0); assert.ok(S.takeLoan(500).ok);
});

t('v3 緊急出清：不受每日需求量限制，單價 = 市價 × 新鮮度 × 0.7（比正常賣便宜）', () => {
  const { st } = fresh3({ money: 100 });
  S.setMode('f1', 'pause');
  const D = S.demandToday();
  st.res.inv.f1 = D + 200; st.res.soldToday.f1 = D; // 今日需求量已賣滿
  assert.ok(!S.sellInventory('f1', 10).ok, '正常賣出被需求量擋住');
  const expect = Math.round((D + 200) * E.sellPrice(bal, 'f1', st.res.rep, st.res.priceWalk) * bal.emergency.priceMul);
  assert.equal(S.emergencyQuote('f1'), expect);
  const r = S.emergencySell('f1');
  assert.ok(r.ok && r.n === D + 200 && r.revenue === expect); assert.equal(st.res.inv.f1, 0); assert.equal(st.res.money, 100 + expect);
  // 每片單價比正常賣出（含壓價）低
  const per = E.emergencyRevenue(bal, 'f1', 20, 1, 100, 0) / 100;
  assert.ok(per < E.sellRevenue(bal, 'f1', 20, 1, 160, 0, 160, 0) / 160);
  // 舊庫存再打折
  assert.ok(E.emergencyRevenue(bal, 'f1', 20, 1, 100, 10) < E.emergencyRevenue(bal, 'f1', 20, 1, 100, 0));
  assert.ok(!S.emergencySell('f1').ok);
});

t('v3 自動賣出：價格指數 ≥ 門檻、或庫存 ≥ N；保留訂單量、遵守每日需求量', () => {
  const A = { sell: true, sellIdx: 1.1, inv: false, invN: 250 };
  assert.equal(E.autoSellPlan(bal, A, { inv: 100, walk: 1.2, room: 160 }), 100);
  assert.equal(E.autoSellPlan(bal, A, { inv: 100, walk: 1.05, room: 160 }), 0);
  assert.equal(E.autoSellPlan(bal, A, { inv: 100, walk: 1.2, room: 60 }), 60);
  assert.equal(E.autoSellPlan(bal, A, { inv: 100, reserved: 70, walk: 1.2, room: 160 }), 30);
  const B = { sell: false, sellIdx: 1.1, inv: true, invN: 250 };
  assert.equal(E.autoSellPlan(bal, B, { inv: 200, walk: 9, room: 160 }), 0);
  assert.equal(E.autoSellPlan(bal, B, { inv: 300, walk: 0.7, room: 160 }), 160); // 想賣 300−125=175，受每日需求量 160 限制
  assert.equal(E.autoSellPlan(bal, B, { inv: 300, walk: 0.7, room: 999 }), 300 - 125);
  assert.equal(E.autoSellPlan(bal, null, { inv: 300, walk: 2, room: 160 }), 0);
  // 模擬：每日結算時觸發
  const { st } = fresh3({ money: 5000 });
  S.setMode('f1', 'pause');
  S.setAuto('f1', { sell: true, sellIdx: 0.8 });
  st.res.inv.f1 = 100;
  let sold = 0; const off = bus.on('auto:sold', e => { sold += e.n; });
  ticks(24);
  if (typeof off === 'function') off();
  assert.equal(sold, 100); assert.equal(st.res.inv.f1, 0); assert.ok(st.res.money > 5000 - 75);
  S.setAuto('f1', { sell: true, sellIdx: 1.4 }); st.res.inv.f1 = 100; st.res.priceWalk = 0.9;
  ticks(24); assert.equal(st.res.inv.f1, 100, '價格未達門檻不賣');
});

t('v3 低現金防護：現金低於門檻自動改「只做完在製品」並通知；手動硬開時讓路，錢回升後重新武裝', () => {
  const { st } = fresh3({ money: 1500 });
  S.setAuto('f1', { guard: true, guardCash: 2000 });
  let trig = 0; const off = bus.on('guard:triggered', () => trig++);
  const started = count('lot:started', () => ticks(1));
  assert.equal(S.fabMode('f1'), 'drain'); assert.equal(trig, 1); assert.equal(started, 0);
  S.setMode('f1', 'run');
  assert.equal(st.fabs.f1.auto.hold, true);
  ticks(3); assert.equal(S.fabMode('f1'), 'run'); assert.equal(trig, 1, '玩家手動恢復後不會立刻又被防護擋掉');
  st.res.money = 3000; ticks(1); assert.equal(st.fabs.f1.auto.hold, false);
  st.res.money = 1000; ticks(1);
  if (typeof off === 'function') off();
  assert.equal(S.fabMode('f1'), 'drain'); assert.equal(trig, 2);
  assert.equal(E.guardDefault(bal, 'f1'), 1200); // (900 + 250) 取整到 100
});

t('v3 維運付不出來與狀態一致：運轉中扣聲望 1；只剩暫停／封存的小額維運只輕罰', () => {
  const a = fresh3({ money: 0 });
  S.setMode('f1', 'drain'); // 不投片
  const r0 = a.st.res.rep; ticks(24);
  near(a.st.res.rep, r0 - 1, 1e-9); assert.equal(a.st.res.money, 0);
  const b = fresh3({ money: 0 });
  S.setMode('f1', 'pause'); const r1 = b.st.res.rep; ticks(24);
  near(b.st.res.rep, r1 - bal.mode.idleUnpaidRep, 1e-9);
  const c = fresh3({ money: 100 }); // 封存的 25 付得起 → 不罰
  S.setMode('f1', 'mothball'); const r2 = c.st.res.rep; ticks(24);
  near(c.st.res.rep, r2, 1e-9); assert.equal(c.st.res.money, 75);
});

t('v3 斷鏈偵測：沒在製、沒庫存、錢不夠投 1 Lot → stuck；有貸款額度走貸款，否則給增資', () => {
  const lot = E.lotCost(bal, 'f1');
  const { st } = fresh3({ money: lot - 1 });
  let d = S.deadEndInfo();
  assert.ok(d.stuck); assert.equal(d.need, lot); assert.ok(d.loanOk); assert.ok(d.equipCount === 4 && d.refund > 0);
  st.res.money = lot; assert.ok(!S.deadEndInfo().stuck);
  st.res.money = 10; st.res.inv.f1 = 5; assert.ok(!S.deadEndInfo().stuck, '有庫存可賣 → 不算斷鏈');
  st.res.inv.f1 = 0; st.fabs.f1.lots.push({ id: 1, slot: 0, progress: 0 }); assert.ok(!S.deadEndInfo().stuck, '有在製 → 不算斷鏈');
  st.fabs.f1.lots = [];
  // 缺機台：要看最便宜的缺口（furnace 700）
  st.fabs.f1.slots[1] = null; st.res.money = 650; assert.ok(S.deadEndInfo().stuck);
  st.res.money = 700; assert.ok(!S.deadEndInfo().stuck);
  // 封存的廠：需要重啟費 + 1 Lot
  fresh3({ money: lot + 100 }); S.setMode('f1', 'mothball');
  d = S.deadEndInfo(); assert.ok(d.stuck); assert.equal(d.need, lot + 500);
  // sim 會發出 deadend 事件；貸款後解除
  fresh3({ money: 5 });
  assert.equal(count('deadend', () => ticks(8)), 1);
  assert.ok(S.takeLoan(2000).ok); assert.ok(!S.deadEndInfo().stuck);
  // 貸款被封鎖（逾期）→ loanOk=false，rescueGrant 才給錢（並扣聲望）
  const o = fresh3({ money: 5 });
  o.st.res.loans.push({ id: 1, principal: 1000, owed: 1000, dueDay: 0, overdue: true });
  d = S.deadEndInfo(); assert.ok(d.stuck && !d.loanOk && d.grant >= bal.rescue.min);
  const rep0 = o.st.res.rep; const g = S.rescueGrant();
  assert.ok(g.ok && o.st.res.money === 5 + d.grant); near(o.st.res.rep, rep0 - bal.rescue.repLoss, 1e-9);
  assert.ok(!S.deadEndInfo().stuck); assert.ok(!S.rescueGrant().ok);
  // 還有貸款額度時不給增資
  fresh3({ money: 5 }); assert.ok(!S.rescueGrant().ok);
  // 賣機台也是出路
  const q = fresh3({ money: 5 }); const before = q.st.res.money;
  assert.ok(S.sellEquip('f1', 0).ok); assert.ok(q.st.res.money > before);
});

t('v3 存檔 v2 → v3 migration：補上狀態／暖機／自動化／貸款並保留原資料', () => {
  const v2 = { version: 2, clock: { tick: 48, speed: 1, paused: true }, rng: { seed: 5 },
    res: { money: 321, rep: 22, inv: { f1: 3 } }, fabs: { f1: { unlocked: true, slots: [null, null, null, null], lots: [], rate: 1.2 } } };
  const r = migrate(v2);
  assert.ok(r.ok && r.save.version === 3);
  assert.equal(r.save.fabs.f1.mode, 'run'); assert.equal(r.save.fabs.f1.ramp, 0); assert.equal(r.save.fabs.f1.rate, 1.2);
  assert.equal(r.save.fabs.f1.auto.sell, false); assert.equal(r.save.fabs.f1.auto.guard, false);
  assert.deepEqual(r.save.res.loans, []); assert.equal(r.save.res.money, 321);
  assert.equal(v2.version, 2);
  assert.equal(migrate({ ...v2, fabs: { f1: { ...v2.fabs.f1, mode: 'pause', auto: { sell: true } } } }).save.fabs.f1.mode, 'pause'); // 不覆蓋既有欄位
  fresh3();
  S.importJson(JSON.stringify(v2)); // normalize：載入後補齊所有廠
  const s2 = S.getState();
  assert.equal(S.fabMode('f2'), 'run'); assert.equal(s2.fabs.f1.auto.sellIdx, 1.1); assert.deepEqual(s2.res.loans, []);
});


t('值班建議優先履約、保留訂單庫存、辨識停機與擴建條件', () => {
  const { st } = fresh3({ money: 100 });
  const get = () => operatingAdvice(bal, st, 'f1', Sim.fabStatsNow('f1'), E.lineProjection(bal, 'f1', st.fabs.f1, 0));
  st.res.inv.f1 = 100;
  st.res.contracts.active = [{ id: 1, fabId: 'f1', qty: 80, minY: 0.99 }];
  let a = get(); assert.equal(a.action, 'sell'); assert.equal(a.sellQty, 20);
  st.res.contracts.active[0].minY = 0.4;
  a = get(); assert.equal(a.action, 'market'); assert.equal(a.contract, 1);
  st.res.contracts.active = []; st.res.inv.f1 = 0;
  assert.equal(get().action, 'ops');
  st.res.money = 100000; st.fabs.f1.mode = 'pause'; assert.equal(get().action, 'ops');
  st.fabs.f1.mode = 'run'; st.fabs.f1.slots[1] = null; assert.equal(get().slot, 1);
  fresh3({ money: 100000 });
  const ready = S.getState();
  const check = () => operatingAdvice(bal, ready, 'f1', Sim.fabStatsNow('f1'), E.lineProjection(bal, 'f1', ready.fabs.f1, 0));
  assert.equal(check().goal.id, 'f2'); assert.equal(check().action, 'unlock');
  for (const id of E.levelIds(bal, 'f2')) ready.puzzle.stars[id] = 2;
  assert.equal(check().title, '準備好擴建下一座廠');
});

t('開局週轉金足以完成首批生產，不需貸款或提前出清', () => {
  S.initState(bal, { fresh: true });
  const s = S.getState();
  const budget = E.startupBudget(bal, 'f1');
  assert.ok(bal.start.money >= budget.total);
  for (let i = 0; i < s.fabs.f1.slots.length; i++) {
    const id = E.allowedEquip(bal, 'f1', i).sort((a, b) => E.equipPrice(bal, 'f1', a) - E.equipPrice(bal, 'f1', b))[0];
    assert.ok(S.buyEquip('f1', i, id).ok);
  }
  const firstTicks = budget.firstShipTicks + 1;
  ticks(firstTicks);
  assert.ok(s.res.inv.f1 > 0, '首批應已完成');
  assert.ok(s.res.money >= E.lotCost(bal, 'f1'), '首批完成時仍可投片');
  assert.equal(s.res.loans.length, 0);
  for (const id of bal.fabOrder) {
    const b = E.startupBudget(bal, id);
    assert.equal(b.total, bal.fabs[id].unlockMoney + b.kit + b.working);
    assert.ok(b.working >= E.lotCost(bal, id) * b.lots);
  }
});

t('無頭模擬：貪婪玩家的節奏（Fab 2 約第 18–28 天可負擔）', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => (i + 1) * 7919);
  const days = seeds.map(sd => runGreedy({ days: 70, seed: sd }).affordable.f2 ?? 999).sort((x, y) => x - y);
  const med = days[Math.floor(days.length / 2)];
  console.log('   Fab 2 affordable day per seed (sorted):', days.join(','), '| median', med);
  assert.ok(med >= 18 && med <= 28, `median ${med} out of range`);
  assert.ok(days[0] >= 8, 'no seed should afford Fab 2 before day 8');
});

console.log(`\n${n} tests passed`);

