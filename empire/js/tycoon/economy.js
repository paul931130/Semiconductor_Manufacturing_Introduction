// 純函式：良率 / 營收 / 成本公式（DESIGN.md §3）。所有數值由 bal (balance.json) 傳入，不寫死。

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function fabIndex(bal, fabId) { return bal.fabOrder.indexOf(fabId); }
export function fabMult(bal, fabId) { return bal.fabMult[fabIndex(bal, fabId)]; }

/** 可放入某槽位的機台 id 清單（類別相符，且受 fabs 限制，例如 f4–f5 微影只能 scanner） */
export function allowedEquip(bal, fabId, slotIdx) {
  const cat = bal.fabs[fabId].slots[slotIdx];
  return Object.keys(bal.equipment).filter(id => {
    const e = bal.equipment[id];
    return e.category === cat && (!e.fabs || e.fabs.includes(fabId));
  });
}

/** 機台購買價 = price × 廠倍率 */
export function equipPrice(bal, fabId, equipId) {
  return bal.equipment[equipId].price * fabMult(bal, fabId);
}

/** 升級費 = price × 廠倍率 × 1.8^L（L=目前等級），取整數 */
export function upgradeCost(bal, fabId, equipId, level) {
  return Math.round(equipPrice(bal, fabId, equipId) * Math.pow(bal.equip.upgradeBase, level));
}

/** 出售退款 = 50% 當前總投入 */
export function sellRefund(bal, invested) {
  return Math.round(invested * bal.equip.sellRefund);
}

/** 槽位處理時間 p = 4 / (speed × (1 + 0.15×(L−1)))（遊戲小時 = tick） */
export function slotHours(bal, equipId, level) {
  const e = bal.equipment[equipId];
  return bal.equip.baseHours / (e.speed * (1 + bal.equip.speedPerLevel * (level - 1)));
}

/** 線速度：每 max(p) 小時投入一個 Lot；slots 為 p 陣列（空槽以 null 表示 → 產線不通，回 null） */
export function lineInterval(hours) {
  if (!hours.length || hours.some(h => h == null)) return null;
  return Math.max(...hours);
}

/** 單槽缺陷率 d_i = D0 × defMul × 0.80^(L−1) × (1 − 0.5 S) × (1 + Σ eventDef) */
export function slotDefect(bal, fabId, equipId, level, S, eventDef = 0) {
  const y = bal.yield;
  return bal.fabs[fabId].D0 * bal.equipment[equipId].defMul
    * Math.pow(y.levelFactor, level - 1) * (1 - y.starHalf * S) * (1 + eventDef);
}

/** 單槽良率 y_i = 1 − min(d_i, 0.5) */
export function slotYield(bal, fabId, equipId, level, S, eventDef = 0) {
  return 1 - Math.min(slotDefect(bal, fabId, equipId, level, S, eventDef), bal.yield.dMax);
}

/** 線良率 Y = clamp(Π y_i × E, 0.05, 0.99)；slots 為 [{equip, level}|null]，空槽略過 */
export function lineYield(bal, fabId, slots, S = 0, mods = {}) {
  const eventDef = mods.eventDef || 0;
  const E = mods.E == null ? 1 : mods.E;
  let prod = 1;
  for (const s of slots) {
    if (!s) continue;
    prod *= slotYield(bal, fabId, s.equip, s.level, S, eventDef);
  }
  return clamp(prod * E, bal.yield.yMin, bal.yield.yMax);
}

/** 解謎星數比 S = Σ stars / (3 × 關數) */
export function starRatio(bal, fabId, stars) {
  const n = bal.fabs[fabId].puzzleLevels;
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += clamp(Math.floor((stars && stars[`${fabId}-${i}`]) || 0), 0, 3);
  return sum / (3 * n);
}

export function levelIds(bal, fabId) {
  return Array.from({ length: bal.fabs[fabId].puzzleLevels }, (_, i) => `${fabId}-${i + 1}`);
}

/** 售價 = 廠基準價 × (0.9 + 0.2 × rep/100) × 市場波動 */
export function sellPrice(bal, fabId, rep, walk = 1) {
  return bal.fabs[fabId].price * (0.9 + 0.2 * rep / 100) * walk;
}

/** 每出貨一 Lot：rep += (Y − 0.75) × 2 */
export function repGain(bal, Y) {
  return (Y - bal.rep.neutralYield) * bal.rep.perLotFactor;
}

/** 標稱毛利(良率=1) = 1 − 成本/價；盈虧平衡良率 = 成本/價 */
export function nominalMargin(bal, fabId) { const f = bal.fabs[fabId]; return 1 - f.cost / f.price; }
export function breakEvenYield(bal, fabId) { const f = bal.fabs[fabId]; return f.cost / f.price; }

/** 市場價格指數：均值回歸 + 隨機步 + 偶發衝擊（shock 為加算），限 priceMin–priceMax。r ∈ [0,1) */
export function nextPriceWalk(bal, walk, r, shock = 0) {
  const m = bal.market;
  return clamp(walk + m.revert * (1 - walk) + (r * 2 - 1) * m.priceStep + shock, m.priceMin, m.priceMax);
}
/** 需求指數：同樣均值回歸，限 demandMin–demandMax */
export function nextDemand(bal, d, r) {
  const m = bal.market;
  return clamp(d + m.demandRevert * (1 - d) + (r * 2 - 1) * m.demandStep, m.demandMin, m.demandMax);
}
/** 每日市場需求量（片）= demandCap × 需求指數 */
export function dailyDemand(bal, demandIdx) { return Math.max(1, Math.round(bal.demandCap * demandIdx)); }
/** 庫存新鮮度：1 − decay × 平均庫齡（日），不低於 floor */
export function freshness(bal, age) { return Math.max(bal.market.ageFloor, 1 - bal.market.ageDecay * age); }
/** 新增 addN 片（庫齡 0）後的平均庫齡 */
export function mergeAge(age, n, addN) { return n + addN > 0 ? age * n / (n + addN) : 0; }
/** 每日倉儲成本 = 片數 × 每片成本 × holdRate */
export function holdCost(bal, fabId, n) { return n * bal.fabs[fabId].cost * bal.market.holdRate; }
/** 今日還能賣的片數（今日已賣 sold0） */
export function sellRoom(D, sold0) { return Math.max(0, D - sold0); }
/** 賣出 n 片的營收：單價 × 新鮮度 ×（1 − slip × 賣出進度中點 / D）；賣越多單價被壓得越低 */
export function sellRevenue(bal, fabId, rep, walk, D, sold0, n, age = 0) {
  if (n <= 0) return 0;
  const p = sellPrice(bal, fabId, rep, walk) * freshness(bal, age);
  return n * p * (1 - bal.market.slip * (sold0 + n / 2) / D);
}

/** 產線轉速 rate：製程時間 ÷ rate；缺陷率 × (1 + rateDefect × (rate−1)) */
export function rateMods(bal, rate = 1) {
  const r = clamp(rate, bal.rate.min, bal.rate.max);
  return { pMul: 1 / r, defMul: Math.max(0.2, 1 + bal.rate.defect * (r - 1)) };
}

/** 瓶頸槽：處理時間最長者（同分取前者）；產線不通回 -1 */
export function bottleneckIndex(hours) {
  if (!hours.length || hours.some(h => h == null)) return -1;
  let b = 0;
  hours.forEach((h, i) => { if (h > hours[b] + 1e-9) b = i; });
  return b;
}

/** 並列瓶頸：所有與最慢者同分的槽（只升其中一槽，產能不會變）；產線不通回 [] */
export function bottleneckSet(hours) {
  const b = bottleneckIndex(hours);
  if (b < 0) return [];
  return hours.map((h, i) => i).filter(i => hours[i] >= hours[b] - 1e-9);
}

/** 日損益預估（行情 walk、需求 demandIdx；預設標準行情）：產出受瓶頸限制，銷量受需求限制 */
export function lineProjection(bal, fabId, fab, S, mods = {}, rep = 20, walk = 1, demandIdx = 1) {
  const st = fabStats(bal, fabId, fab, S, mods, rep, walk);
  const D = dailyDemand(bal, demandIdx);
  const good = st.wafersPerDay * st.Y;
  const sold = Math.min(good, D);
  const f = bal.fabs[fabId];
  const revenue = sold > 0 ? sellRevenue(bal, fabId, rep, walk, D, 0, sold, 0) : 0;
  // 庫存滿了產線會暫停投片：供過於求時，實際投片 ≈ 賣得掉的量 ÷ 良率
  const started = good > D ? Math.min(st.wafersPerDay, D / Math.max(st.Y, 1e-9)) : st.wafersPerDay;
  const startCost = started * f.cost;
  return {
    Y: st.Y, wafersPerDay: st.wafersPerDay, goodPerDay: good, demand: D, sold, revenue, startCost,
    maintenance: f.maintenance, profitPerDay: st.complete ? revenue - startCost - f.maintenance : 0,
    saturated: good > D, bottleneck: bottleneckIndex(st.hours), bottlenecks: bottleneckSet(st.hours), complete: st.complete
  };
}

/** 客戶訂單：r 為 4 個 [0,1) 亂數。單價鎖定（不受行情影響），須交付良率 ≥ minY */
export function makeContract(bal, fabId, rep, Y, r, id, day) {
  const c = bal.contracts;
  const D = bal.demandCap;
  const qty = Math.max(10, Math.round(D * (c.qtyMin + (c.qtyMax - c.qtyMin) * r[0]) / 5) * 5);
  const prem = c.premMin + (c.premMax - c.premMin) * r[1];
  const unitPrice = Math.round(sellPrice(bal, fabId, rep, 1) * prem * 100) / 100;
  // 多數訂單的良率門檻落在「目前良率附近」；少數(stretch)是明確標示的挑戰單
  const stretch = (r[4] ?? 0.5) < c.stretchChance;
  const lo = stretch ? c.stretchMin : c.yieldMin, hi = stretch ? c.stretchMax : c.yieldMax;
  const minY = clamp(Math.round((Y + lo + (hi - lo) * r[2]) * 100) / 100, 0.4, 0.97);
  const days = c.daysMin + Math.floor(r[3] * (c.daysMax - c.daysMin + 1));
  return { id, fabId, qty, minY, unitPrice, days, stretch, premium: Math.round(prem * 100) / 100,
    penalty: Math.round(qty * unitPrice * c.penaltyFrac), offerEnd: day + c.offerDays, deadline: null };
}
export const contractPayout = c => Math.round(c.qty * c.unitPrice);

/** 單 Lot 投片成本 */
export function lotCost(bal, fabId) { return bal.fabs[fabId].cost * bal.lotSize; }

/** 開廠預算：最便宜完整產線、首批出貨前的在製批次、兩日維運。 */
export function startupBudget(bal, fabId) {
  const slots = bal.fabs[fabId].slots.map((_, i) => {
    const equip = allowedEquip(bal, fabId, i).sort((a, b) => equipPrice(bal, fabId, a) - equipPrice(bal, fabId, b))[0];
    return { equip, level: 1 };
  });
  const kit = slots.reduce((sum, sl) => sum + equipPrice(bal, fabId, sl.equip), 0);
  const hours = slots.map(sl => slotHours(bal, sl.equip, 1));
  // 離散 tick 中，每一槽至少要完整占用 ceil(hours) 個 tick。
  const firstShipTicks = hours.reduce((sum, h) => sum + Math.ceil(h), 0);
  const lots = Math.ceil(firstShipTicks / Math.max(...hours));
  const working = lots * lotCost(bal, fabId) + bal.fabs[fabId].maintenance * 2;
  return { kit, working, lots, firstShipTicks, total: bal.fabs[fabId].unlockMoney + kit + working };
}

/** 解鎖條件狀態 */
export function unlockStatus(bal, fabId, { money, rep, stars }) {
  const f = bal.fabs[fabId];
  const ids = levelIds(bal, fabId);
  const cleared = ids.filter(id => (stars?.[id] || 0) >= 1).length;
  const puzzle = { have: cleared, need: ids.length, ok: cleared >= ids.length };
  const m = { have: money, need: f.unlockMoney, ok: money >= f.unlockMoney };
  const r = { have: rep, need: f.unlockRep, ok: rep >= f.unlockRep };
  return { puzzle, money: m, rep: r, all: puzzle.ok && m.ok && r.ok };
}

/** 整合：某廠目前的產線統計（UI 與模擬共用） */
export function fabStats(bal, fabId, fab, S, mods = {}, rep = 20, walk = 1) {
  const pMul = mods.pMul == null ? 1 : mods.pMul;
  const hours = fab.slots.map(s => (s ? slotHours(bal, s.equip, s.level) * pMul : null));
  const interval = lineInterval(hours);
  const bottleneck = bottleneckIndex(hours);
  const Y = lineYield(bal, fabId, fab.slots, S, mods);
  const complete = fab.slots.every(Boolean);
  const lotsPerDay = interval ? bal.ticksPerDay / interval : 0;
  return {
    hours, interval, Y, complete, lotsPerDay, bottleneck, bottlenecks: bottleneckSet(hours),
    wafersPerDay: lotsPerDay * bal.lotSize,
    price: sellPrice(bal, fabId, rep, walk),
    breakEven: breakEvenYield(bal, fabId)
  };
}

// ---------- v3：產線狀態、貸款、緊急出清、自動化、斷鏈偵測（DESIGN §3.9） ----------
export const MODES = ['run', 'drain', 'pause', 'mothball'];
export const modeOf = fab => (fab && MODES.includes(fab.mode) ? fab.mode : 'run');
/** 該狀態是否仍在加工（運轉／只做完在製品會推進 Lot；暫停與封存不會） */
export const modeAdvances = mode => mode === 'run' || mode === 'drain';
export const upkeepMul = (bal, mode) => bal.mode.upkeep[mode] ?? 1;
/** 某廠某狀態的每日維運費 */
export const fabUpkeep = (bal, fabId, mode) => Math.round(bal.fabs[fabId].maintenance * upkeepMul(bal, mode));
/** 封存後重新啟動費 = 廠倍率 × restartPerMult */
export const restartCost = (bal, fabId) => Math.round(fabMult(bal, fabId) * bal.mode.restartPerMult);

/** 授信額度 = (基本額度 + 聲望 × perRep) × 已開通最高階廠的倍率，取整到 100 */
export function creditLimit(bal, rep, unlockedIds) {
  const top = Math.max(0, ...unlockedIds.map(id => fabIndex(bal, id)));
  return Math.round((bal.loan.baseLimit + bal.loan.perRep * Math.max(0, rep)) * bal.fabMult[top] / 100) * 100;
}
export const loansOwed = loans => (loans || []).reduce((a, l) => a + l.owed, 0);
export const loansOverdue = loans => (loans || []).some(l => l.overdue);
/** 還能借多少（逾期中不能再借）。取整到 100 */
export function loanAvailable(bal, rep, unlockedIds, loans) {
  if (loansOverdue(loans)) return 0;
  return Math.max(0, Math.floor((creditLimit(bal, rep, unlockedIds) - loansOwed(loans)) / 100) * 100);
}
/** 每日利息 = 本金 × 日利率（逾期加倍），累加到欠款 */
export function loanInterest(bal, loan) {
  return Math.round(loan.principal * (loan.overdue ? bal.loan.overdueRate : bal.loan.dailyRate));
}

/** 緊急出清營收 = 片數 × 單價 × 新鮮度 × priceMul；不受每日需求量限制、不壓價 */
export function emergencyRevenue(bal, fabId, rep, walk, n, age = 0) {
  if (n <= 0) return 0;
  return Math.round(n * sellPrice(bal, fabId, rep, walk) * freshness(bal, age) * bal.emergency.priceMul);
}

/** 自動賣出：回傳這次要賣幾片（0 = 不賣）。price 達標賣到沒空間；庫存達標賣到 invKeepFrac × invN。reserved = 訂單保留量 */
export function autoSellPlan(bal, auto, { inv, reserved = 0, walk, room }) {
  if (!auto) return 0;
  const free = Math.max(0, inv - reserved);
  let want = 0;
  if (auto.sell && walk >= auto.sellIdx - 1e-9) want = free;
  if (auto.inv && inv >= auto.invN) want = Math.max(want, inv - Math.floor(auto.invN * bal.auto.invKeepFrac));
  return Math.max(0, Math.min(Math.floor(want), free, room));
}
/** 低現金防護的預設門檻 = 1 Lot 成本 + 日維運（取整到 100） */
export const guardDefault = (bal, fabId) => Math.round((lotCost(bal, fabId) + bal.fabs[fabId].maintenance) / 100) * 100;
export const defaultAuto = () => ({ sell: false, sellIdx: 1.1, inv: false, invN: 250, guard: false, guardCash: 0, hold: false });

/**
 * 斷鏈偵測：沒有任何在製 Lot、沒有任何庫存，而且錢不夠做下一步（投 1 Lot／補最便宜的缺機台／封存廠的重啟＋投片）。
 * 回傳 { stuck, need, loanAvail, equipCount, refund, grant }。
 */
export function deadEnd(bal, s) {
  let lots = 0, inv = 0, need = Infinity, equipCount = 0, refund = 0;
  const unlocked = [];
  for (const id of bal.fabOrder) {
    const fab = s.fabs[id];
    if (!fab.unlocked) continue;
    unlocked.push(id);
    lots += fab.lots.length; inv += s.res.inv[id] || 0;
    fab.slots.forEach(sl => { if (sl) { equipCount++; refund += sellRefund(bal, sl.invested); } });
    const miss = fab.slots.map((sl, i) => (sl ? null : i)).filter(i => i != null);
    if (miss.length) {
      need = Math.min(need, ...miss.map(i => Math.min(...allowedEquip(bal, id, i).map(e => equipPrice(bal, id, e)))));
    } else {
      need = Math.min(need, lotCost(bal, id) + (modeOf(fab) === 'mothball' ? restartCost(bal, id) : 0));
    }
  }
  const loanAvail = loanAvailable(bal, s.res.rep, unlocked, s.res.loans);
  const stuck = lots === 0 && inv === 0 && Number.isFinite(need) && s.res.money < need;
  const gap = Number.isFinite(need) ? Math.max(0, need - s.res.money) : 0;
  const grant = Math.max(bal.rescue.min, Math.ceil(Math.max(0, need * bal.rescue.needMul - s.res.money) / 100) * 100);
  return { stuck, need: Number.isFinite(need) ? need : 0, gap, loanAvail, loanOk: loanAvail >= Math.max(bal.loan.minBorrow, gap), equipCount, refund, grant };
}
