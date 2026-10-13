// 遊戲狀態 + 存檔（§7.2）+ 玩家動作（買／升／賣機台、開廠、星數）
import { bus } from '../shared/bus.js';
import { loadSave, writeSave, clearSave, parseSaveText, SAVE_VERSION } from '../shared/storage.js';
import * as Eco from './economy.js';

let state = null;
let bal = null;
let loadNotice = null; // 讀檔失敗訊息（例如存檔版本過新）

export const getState = () => state;
export const getBal = () => bal;
export const getLoadNotice = () => loadNotice;

function newFab(fabId, unlocked) {
  return {
    unlocked,
    slots: bal.fabs[fabId].slots.map(() => null),
    ups: false,
    lots: [],
    event: null,
    rate: 1,    // 產線轉速（營運選擇）
    mode: 'run',  // 產線狀態：run 運轉 / drain 只做完在製品 / pause 暫停 / mothball 停機封存（v3）
    ramp: 0,      // 封存重啟後的暖機剩餘 tick（暖機中不投片）
    auto: Eco.defaultAuto(), // 自動化設定（自動賣出、低現金防護）
    halt: 0,    // 停線剩餘 tick
    feed: 999   // 距上次投片已過 tick（>= 線速度才能再投）
  };
}

export function createInitialState(balance, seed) {
  bal = balance;
  const fabs = {}, inv = {}, invAge = {}, soldToday = {};
  for (const id of bal.fabOrder) { fabs[id] = newFab(id, id === 'f1'); inv[id] = 0; invAge[id] = 0; soldToday[id] = 0; }
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    clock: { tick: 0, speed: 1, paused: true },
    rng: { seed: (seed == null ? (Date.now() & 0x7fffffff) : seed) >>> 0 },
    res: {
      money: bal.start.money, rep: bal.start.rep, inv, priceWalk: 1.0, repAcc: 0,
      demandIdx: 1.0, invAge, soldToday, priceHist: [1.0],
      contracts: { offers: [], active: [], nextId: 1, nextOfferDay: 3 },
      loans: [], nextLoanId: 1
    },
    fabs,
    nextLotId: 1,
    puzzle: { stars: {}, hintsBought: {} },
    seenFacts: [],
    tutorial: { done: [] },
    settings: { sound: 0.5, diffHighlight: true, reduceMotion: false }
  };
}

/** 補齊缺漏欄位（版本相同但缺欄位時的防禦） */
function normalize(s) {
  const base = createInitialState(bal, s.rng?.seed);
  const out = { ...base, ...s };
  out.clock = { ...base.clock, ...s.clock };
  out.res = { ...base.res, ...s.res, inv: { ...base.res.inv, ...(s.res?.inv || {}) },
    invAge: { ...base.res.invAge, ...(s.res?.invAge || {}) }, soldToday: { ...base.res.soldToday, ...(s.res?.soldToday || {}) },
    contracts: { ...base.res.contracts, ...(s.res?.contracts || {}) },
    loans: Array.isArray(s.res?.loans) ? s.res.loans : [] };
  out.puzzle = { ...base.puzzle, ...s.puzzle };
  out.settings = { ...base.settings, ...s.settings };
  out.tutorial = { ...base.tutorial, ...s.tutorial };
  out.fabs = {};
  for (const id of bal.fabOrder) {
    const f = { ...newFab(id, id === 'f1'), ...(s.fabs?.[id] || {}) };
    f.auto = { ...Eco.defaultAuto(), ...(s.fabs?.[id]?.auto || {}) };
    if (!Eco.MODES.includes(f.mode)) f.mode = 'run';
    const len = bal.fabs[id].slots.length;
    f.slots = Array.from({ length: len }, (_, i) => f.slots[i] || null);
    out.fabs[id] = f;
  }
  return out;
}

export function initState(balance, { fresh = false } = {}) {
  bal = balance;
  loadNotice = null;
  if (!fresh) {
    const r = loadSave();
    if (r.ok) { state = normalize(r.save); return state; }
    if (r.reason === 'too-new') loadNotice = `存檔版本（${r.version}）比本遊戲新，無法讀取；已改開新遊戲（不會覆寫舊存檔，直到你第一次存檔）。`;
    else if (r.reason === 'invalid') loadNotice = '存檔已損毀，已改開新遊戲。';
  }
  state = createInitialState(bal);
  return state;
}

export function save() {
  if (!state) return false;
  state.savedAt = Date.now();
  return writeSave(state);
}
export function changed() { bus.emit('state:changed', state); }
export function commit() { save(); changed(); }

export function resetGame() {
  clearSave();
  state = createInitialState(bal);
  bus.emit('state:reset', state);
  changed();
}
export function exportJson() { return JSON.stringify(state, null, 2); }
export function importJson(text) {
  const r = parseSaveText(text);
  if (!r.ok) return r;
  state = normalize(r.save);
  state.clock.paused = true;
  save();
  bus.emit('state:reset', state);
  changed();
  return { ok: true };
}

// ---------- 查詢 ----------
export const starRatio = fabId => Eco.starRatio(bal, fabId, state.puzzle.stars);
export const isUnlocked = fabId => !!state.fabs[fabId]?.unlocked;
export const unlockStatus = fabId => Eco.unlockStatus(bal, fabId,
  { money: state.res.money, rep: state.res.rep, stars: state.puzzle.stars });
export const totalInventory = () => Object.values(state.res.inv).reduce((a, b) => a + b, 0);

// ---------- 資金 ----------
export function spend(amount, reason) {
  amount = Math.round(amount);
  if (!(amount >= 0) || state.res.money < amount) return false;
  state.res.money -= amount;
  bus.emit('money:spent', { amount, reason });
  commit();
  return true;
}
export function earn(amount) { state.res.money += Math.round(amount); commit(); }
export function addRep(d) {
  state.res.rep = Eco.clamp(state.res.rep + d, bal.rep.min, bal.rep.max);
}

// ---------- 機台 ----------
export function buyEquip(fabId, idx, equipId) {
  const fab = state.fabs[fabId];
  if (!fab?.unlocked) return { ok: false, reason: '此廠尚未開通' };
  if (fab.slots[idx]) return { ok: false, reason: '槽位已有機台' };
  if (!Eco.allowedEquip(bal, fabId, idx).includes(equipId)) return { ok: false, reason: '此機台不適用於該槽位' };
  const price = Eco.equipPrice(bal, fabId, equipId);
  if (state.res.money < price) return { ok: false, reason: '資金不足' };
  state.res.money -= price;
  fab.slots[idx] = { equip: equipId, level: 1, invested: price };
  bus.emit('money:spent', { amount: price, reason: 'buy:' + equipId });
  commit();
  return { ok: true };
}
export function upgradeCostOf(fabId, idx) {
  const s = state.fabs[fabId].slots[idx];
  if (!s || s.level >= bal.equip.maxLevel) return null;
  return Eco.upgradeCost(bal, fabId, s.equip, s.level);
}
export function upgradeEquip(fabId, idx) {
  const s = state.fabs[fabId].slots[idx];
  if (!s) return { ok: false, reason: '空槽' };
  const cost = upgradeCostOf(fabId, idx);
  if (cost == null) return { ok: false, reason: '已達最高等級' };
  if (state.res.money < cost) return { ok: false, reason: '資金不足' };
  state.res.money -= cost;
  s.level += 1;
  s.invested += cost;
  bus.emit('money:spent', { amount: cost, reason: 'upgrade:' + s.equip });
  commit();
  return { ok: true };
}
export function sellEquip(fabId, idx) {
  const s = state.fabs[fabId].slots[idx];
  if (!s) return { ok: false, reason: '空槽' };
  const refund = Eco.sellRefund(bal, s.invested);
  state.res.money += refund;
  state.fabs[fabId].slots[idx] = null;
  const ev = state.fabs[fabId].event;
  if (ev?.id === 'tool_failure' && ev.extra?.slot === idx) state.fabs[fabId].event = null;
  commit();
  return { ok: true, refund };
}
export function upsCost(fabId) { return Eco.fabMult(bal, fabId) * bal.events.upsCostPerMult; }
export function buyUps(fabId) {
  const fab = state.fabs[fabId];
  if (fab.ups) return { ok: false, reason: '已安裝' };
  if (!spend(upsCost(fabId), 'ups:' + fabId)) return { ok: false, reason: '資金不足' };
  fab.ups = true;
  commit();
  return { ok: true };
}

// ---------- 開廠 / 解謎 ----------
export function unlockFab(fabId) {
  if (isUnlocked(fabId)) return { ok: false, reason: '已開通' };
  const u = unlockStatus(fabId);
  if (!u.all) return { ok: false, reason: '條件未滿足', status: u };
  state.res.money -= bal.fabs[fabId].unlockMoney;
  state.fabs[fabId].unlocked = true;
  bus.emit('fab:unlocked', { fabId });
  commit();
  return { ok: true };
}

/** startPuzzleSet resolve 後呼叫：取歷史最佳星數、記錄提示、重算 S */
export function applyPuzzleResult(res) {
  if (!res) return;
  const stars = state.puzzle.stars;
  for (const [id, n] of Object.entries(res.stars || {})) {
    stars[id] = Math.max(stars[id] || 0, Math.min(3, Math.max(0, Math.floor(n))));
  }
  for (const [id, n] of Object.entries(res.hintsBought || {})) {
    state.puzzle.hintsBought[id] = Math.max(state.puzzle.hintsBought[id] || 0, n);
  }
  commit();
  bus.emit('puzzle:applied', { fabId: res.fabId });
}

export function markFactSeen(factId) {
  if (!state.seenFacts.includes(factId)) { state.seenFacts.push(factId); save(); }
}
export function setSetting(k, v) { state.settings[k] = v; commit(); }

// ---------- 營運選擇：產線轉速 ----------
export function setRate(fabId, rate) {
  const fab = state.fabs[fabId];
  if (!fab?.unlocked || !bal.rate.steps.includes(rate)) return { ok: false, reason: '無法設定' };
  fab.rate = rate;
  commit();
  return { ok: true };
}

// ---------- 市場：手動賣出 ----------
export const demandToday = () => Eco.dailyDemand(bal, state.res.demandIdx);
export function sellRoom(fabId) {
  return Math.min(state.res.inv[fabId], Eco.sellRoom(demandToday(), state.res.soldToday[fabId] || 0));
}
/** 預覽賣出 n 片（不改狀態） */
export function sellQuote(fabId, n) {
  const r = state.res;
  return Math.round(Eco.sellRevenue(bal, fabId, r.rep, r.priceWalk, demandToday(), r.soldToday[fabId] || 0, n, r.invAge[fabId] || 0));
}
/** 賣出但不存檔、不廣播 state:changed（模擬層自動賣出用）。回傳實際賣出片數與營收 */
export function sellCore(fabId, n) {
  const r = state.res;
  n = Math.min(Math.floor(n), sellRoom(fabId));
  if (!(n > 0)) return { ok: false, n: 0, revenue: 0 };
  const revenue = sellQuote(fabId, n);
  r.inv[fabId] -= n;
  r.soldToday[fabId] = (r.soldToday[fabId] || 0) + n;
  r.money += revenue;
  bus.emit('inv:sold', { fabId, n, revenue });
  return { ok: true, n, revenue };
}
export function sellInventory(fabId, n) {
  const r = state.res;
  const x = sellCore(fabId, n);
  if (!x.ok) return { ok: false, reason: r.inv[fabId] > 0 ? '今日市場需求已滿，明天再賣' : '沒有庫存' };
  commit();
  return x;
}

// ---------- 緊急出清：不受每日需求量限制，但只拿市價的 priceMul ----------
export function emergencyQuote(fabId) {
  const r = state.res;
  return Eco.emergencyRevenue(bal, fabId, r.rep, r.priceWalk, r.inv[fabId], r.invAge[fabId] || 0);
}
export function emergencySell(fabId) {
  const r = state.res, n = r.inv[fabId];
  if (!(n > 0)) return { ok: false, reason: '沒有庫存' };
  const revenue = emergencyQuote(fabId);
  r.inv[fabId] = 0; r.invAge[fabId] = 0;
  r.money += revenue;
  bus.emit('inv:sold', { fabId, n, revenue, emergency: true });
  commit();
  return { ok: true, n, revenue };
}

// ---------- 產線狀態（運轉 / 只做完在製品 / 暫停 / 停機封存） ----------
export const fabMode = fabId => Eco.modeOf(state.fabs[fabId]);
/**
 * 切換產線狀態。封存時若還有在製 Lot：需 opts.confirmScrap 才會報廢並封存（否則回 needConfirm）。
 * 從封存回運轉要付重啟費並暖機 rampTicks。回傳 { ok, reason?, needConfirm?, scrap?, cost? }
 */
export function setMode(fabId, to, opts = {}) {
  const fab = state.fabs[fabId];
  if (!fab?.unlocked) return { ok: false, reason: '此廠尚未開通' };
  if (!Eco.MODES.includes(to)) return { ok: false, reason: '無效的狀態' };
  const from = Eco.modeOf(fab);
  if (from === to) return { ok: false, reason: '已經是這個狀態' };
  if (from === 'mothball' && to !== 'run') return { ok: false, reason: '封存中的廠要先「重新啟動」' };
  let cost = 0, scrapped = 0;
  if (to === 'mothball' && fab.lots.length) {
    if (!opts.confirmScrap) return { ok: false, needConfirm: true, scrap: fab.lots.length, reason: `還有 ${fab.lots.length} 個在製 Lot，封存會全數報廢` };
    scrapped = fab.lots.length; fab.lots = [];
  }
  if (from === 'mothball' && to === 'run') {
    cost = Eco.restartCost(bal, fabId);
    if (state.res.money < cost) return { ok: false, reason: `重新啟動需要 $${cost.toLocaleString('en-US')}，資金不足` };
    state.res.money -= cost;
    fab.ramp = bal.mode.rampTicks;
    bus.emit('money:spent', { amount: cost, reason: 'restart:' + fabId });
  }
  if (to === 'run' && fab.auto?.guard && state.res.money < fab.auto.guardCash) fab.auto.hold = true; // 玩家硬要開：防護暫時讓路，錢回到門檻上才重新武裝
  fab.mode = to;
  bus.emit('mode:changed', { fabId, from, to, cost, scrapped, by: opts.by || 'player' });
  commit();
  return { ok: true, cost, scrapped };
}

// ---------- 自動化設定 ----------
export function setAuto(fabId, patch, { silent = false } = {}) {
  const fab = state.fabs[fabId];
  if (!fab?.unlocked) return { ok: false, reason: '此廠尚未開通' };
  const a = fab.auto = { ...Eco.defaultAuto(), ...fab.auto };
  const A = bal.auto;
  if ('sell' in patch) a.sell = !!patch.sell;
  if ('inv' in patch) a.inv = !!patch.inv;
  if ('guard' in patch) {
    a.guard = !!patch.guard; a.hold = false;
    if (a.guard && !(a.guardCash > 0)) a.guardCash = Eco.guardDefault(bal, fabId);
  }
  if ('sellIdx' in patch) a.sellIdx = Eco.clamp(Math.round(patch.sellIdx / A.sellIdxStep) * A.sellIdxStep, A.sellIdxMin, A.sellIdxMax);
  if ('invN' in patch) a.invN = Eco.clamp(Math.round(patch.invN), A.invMin, A.invMax);
  if ('guardCash' in patch) a.guardCash = Math.max(0, Math.round(patch.guardCash));
  if (!silent) commit(); // silent：拖曳滑桿中，只改狀態；放開時由呼叫端 commit()
  return { ok: true };
}

// ---------- 銀行貸款 ----------
const unlockedIds = () => bal.fabOrder.filter(f => state.fabs[f].unlocked);
export const creditLimit = () => Eco.creditLimit(bal, state.res.rep, unlockedIds());
export const loanOwed = () => Eco.loansOwed(state.res.loans);
export const loanAvailable = () => Eco.loanAvailable(bal, state.res.rep, unlockedIds(), state.res.loans);
export const loanOverdue = () => Eco.loansOverdue(state.res.loans);
export function takeLoan(amount) {
  amount = Math.floor(amount / 100) * 100;
  if (loanOverdue()) return { ok: false, reason: '有逾期未還的貸款，還清之前不能再借' };
  if (amount < bal.loan.minBorrow) return { ok: false, reason: `最低借款 $${bal.loan.minBorrow}` };
  if (amount > loanAvailable()) return { ok: false, reason: `超過可借額度（還能借 $${loanAvailable().toLocaleString('en-US')}）` };
  const r = state.res;
  const loan = { id: r.nextLoanId++, principal: amount, owed: amount, dueDay: currentDay() + bal.loan.termDays, overdue: false };
  r.loans.push(loan);
  r.money += amount;
  bus.emit('loan:taken', { amount, dueDay: loan.dueDay, id: loan.id });
  commit();
  return { ok: true, loan };
}
/** 還款（隨時可還）：先還逾期的，再還最早到期的。amount 超過欠款或現金時以較小者為準 */
export function repayLoan(amount) {
  const r = state.res;
  let pay = Math.min(Math.floor(amount), Math.floor(r.money), loanOwed());
  if (!(pay > 0)) return { ok: false, reason: r.loans.length ? '資金不足' : '目前沒有貸款' };
  const total = pay;
  const order = [...r.loans].sort((a, b) => (b.overdue - a.overdue) || (a.dueDay - b.dueDay));
  for (const l of order) {
    if (pay <= 0) break;
    const p = Math.min(pay, l.owed);
    l.owed -= p; pay -= p; l.principal = Math.min(l.principal, l.owed);
  }
  r.loans = r.loans.filter(l => l.owed > 0);
  r.money -= total;
  bus.emit('loan:repaid', { amount: total, left: loanOwed() });
  commit();
  return { ok: true, paid: total, left: loanOwed() };
}

// ---------- 斷鏈救援 ----------
export const deadEndInfo = () => Eco.deadEnd(bal, state);
/** 最後手段：股東增資。只有「沒有在製／庫存、錢不夠，而且貸款解不了」時才給 */
export function rescueGrant() {
  const d = deadEndInfo();
  if (!d.stuck) return { ok: false, reason: '目前沒有斷鏈' };
  if (d.loanOk) return { ok: false, reason: '還有貸款額度可以週轉' };
  state.res.money += d.grant;
  addRep(-bal.rescue.repLoss);
  bus.emit('rescue:grant', { amount: d.grant });
  commit();
  return { ok: true, amount: d.grant };
}
/** 所有可出售機台（斷鏈救援清單用） */
export function equipList() {
  const out = [];
  for (const f of unlockedIds()) state.fabs[f].slots.forEach((sl, i) => {
    if (sl) out.push({ fabId: f, idx: i, equip: sl.equip, level: sl.level, refund: Eco.sellRefund(bal, sl.invested) });
  });
  return out.sort((a, b) => b.refund - a.refund);
}


// ---------- 客戶訂單 ----------
export const currentDay = () => Math.floor(state.clock.tick / bal.ticksPerDay);
export function acceptContract(id) {
  const c = state.res.contracts;
  const i = c.offers.findIndex(o => o.id === id);
  if (i < 0) return { ok: false, reason: '訂單已失效' };
  if (c.active.length >= bal.contracts.maxActive) return { ok: false, reason: `同時最多 ${bal.contracts.maxActive} 張訂單` };
  const o = c.offers.splice(i, 1)[0];
  o.deadline = currentDay() + o.days;
  c.active.push(o);
  commit();
  return { ok: true };
}
export function declineContract(id) {
  const c = state.res.contracts;
  c.offers = c.offers.filter(o => o.id !== id);
  commit();
  return { ok: true };
}
/** 交貨檢查：庫存足夠且該廠目前線良率 ≥ minY。yNow 由呼叫端提供（避免循環相依） */
export function contractCheck(c, yNow) {
  const have = state.res.inv[c.fabId];
  return { stockOk: have >= c.qty, yieldOk: yNow >= c.minY, have, yNow };
}
export function deliverContract(id, yNow) {
  const r = state.res, cs = r.contracts;
  const c = cs.active.find(o => o.id === id);
  if (!c) return { ok: false, reason: '訂單已失效' };
  const chk = contractCheck(c, yNow);
  if (!chk.stockOk) return { ok: false, reason: `庫存不足（${chk.have} / ${c.qty} 片）` };
  if (!chk.yieldOk) return { ok: false, reason: `目前線良率 ${(yNow * 100).toFixed(1)}% 低於合約要求 ${(c.minY * 100).toFixed(0)}%` };
  r.inv[c.fabId] -= c.qty;
  const pay = Eco.contractPayout(c);
  r.money += pay;
  addRep(bal.contracts.repGain);
  cs.active = cs.active.filter(o => o !== c);
  bus.emit('contract:done', { id, pay });
  commit();
  return { ok: true, pay };
}
