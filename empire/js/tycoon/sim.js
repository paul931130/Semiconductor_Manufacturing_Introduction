// 每 tick 的模擬：推進 Lot → 槽位完成 → 投新 Lot；每 24 tick 結算（§3.6）
import { bus } from '../shared/bus.js';
import { nextRandom } from '../shared/rng.js';
import * as Eco from './economy.js';
import * as Ev from './events.js';
import { getState, getBal, addRep, save } from './state.js';

export function fabMods(fabId) {
  const s = getState();
  return Ev.eventModifiers(getBal(), s.fabs[fabId]);
}
export function fabStatsNow(fabId) {
  const s = getState(), bal = getBal();
  return Eco.fabStats(bal, fabId, s.fabs[fabId], Eco.starRatio(bal, fabId, s.puzzle.stars),
    fabMods(fabId), s.res.rep, s.res.priceWalk);
}
export function failedSlot(fab) {
  return fab.event?.id === 'tool_failure' ? fab.event.extra.slot : -1;
}

function shipLot(s, bal, fabId, fab, lot, st) {
  const Y = st.Y;
  let good = 0;
  for (let i = 0; i < bal.lotSize; i++) if (nextRandom(s.rng) < Y) good++;
  s.res.repAcc += Eco.repGain(bal, Y);
  const price = Eco.sellPrice(bal, fabId, s.res.rep, s.res.priceWalk);
  let rush = false;
  const ev = fab.event;
  if (ev?.id === 'rush_order' && ev.extra.accepted && ev.extra.pending) {
    ev.extra.pending = false; rush = true;
    s.res.money += Math.round(good * price * bal.events.rushPriceMul);
  } else {
    const room = Math.max(0, bal.invCap - s.res.inv[fabId]);
    const add = Math.min(good, room);
    s.res.invAge[fabId] = Eco.mergeAge(s.res.invAge[fabId] || 0, s.res.inv[fabId], add);
    s.res.inv[fabId] += add;
  }
  bus.emit('lot:shipped', { fabId, lotId: lot.id, good, Y, rush });
}

const starveAt = new Map(); // 不存檔：資金不足提示節流

function advanceFab(s, bal, fabId, fab) {
  if (fab.halt > 0) { fab.halt -= 1; return; }
  const mods = Ev.eventModifiers(bal, fab);
  const st = Eco.fabStats(bal, fabId, fab, Eco.starRatio(bal, fabId, s.puzzle.stars), mods, s.res.rep, s.res.priceWalk);
  const bad = failedSlot(fab);
  const last = fab.slots.length - 1;

  // 由前往後處理（slot 大者優先），讓後方空出的位置能被補上
  fab.lots.sort((a, b) => b.slot - a.slot);
  const done = [];
  for (const lot of fab.lots) {
    const h = st.hours[lot.slot];
    if (h == null || lot.slot === bad) continue;
    lot.progress += 1 / h;
    if (lot.progress < 1) continue;
    if (lot.slot === last) { shipLot(s, bal, fabId, fab, lot, st); done.push(lot); continue; }
    if (fab.lots.some(o => o !== lot && !done.includes(o) && o.slot === lot.slot + 1)) { lot.progress = 1; continue; }
    lot.slot += 1;
    lot.progress = Math.min(lot.progress - 1, 0.999);
  }
  if (done.length) fab.lots = fab.lots.filter(l => !done.includes(l));

  // 投片
  if (fab.feed < 9999) fab.feed += 1;
  if (st.complete && bad < 0 && st.interval != null && fab.feed >= st.interval - 1e-9
      && s.res.inv[fabId] < bal.startHaltInv && !fab.lots.some(l => l.slot === 0)) {
    const cost = Eco.lotCost(bal, fabId);
    if (s.res.money >= cost) {
      s.res.money -= cost;
      fab.lots.push({ id: s.nextLotId++, slot: 0, progress: 0, good: null });
      fab.feed = Math.min(Math.max(fab.feed - st.interval, 0), 0.999); // 保留小數餘量，平均投片間隔 = 瓶頸處理時間
      bus.emit('lot:started', { fabId });
    } else if ((starveAt.get(fabId) ?? -99) + bal.ticksPerDay <= s.clock.tick) {
      starveAt.set(fabId, s.clock.tick);
      bus.emit('toast', '資金不足，無法投片（可出售機台或等待庫存售出）');
    }
  }
}

/** 客戶訂單：過期懲罰、訂單報價過期、定期新增報價 */
function contractsDay(s, bal, day) {
  const cs = s.res.contracts, cfg = bal.contracts;
  const left = [];
  for (const c of cs.active) {
    if (day >= c.deadline) {
      const pen = Math.min(c.penalty, s.res.money);
      s.res.money -= pen; addRep(-cfg.repLoss);
      bus.emit('toast', `訂單逾期未交貨：違約金 -$${pen.toLocaleString('en-US')}，聲望 -${cfg.repLoss}`);
    } else left.push(c);
  }
  cs.active = left;
  cs.offers = cs.offers.filter(o => day < o.offerEnd);
  if (day >= cs.nextOfferDay && cs.offers.length < cfg.maxOffers) {
    const open = bal.fabOrder.filter(f => s.fabs[f].unlocked && s.fabs[f].slots.every(Boolean));
    if (open.length) {
      const fabId = open[Math.floor(nextRandom(s.rng) * open.length)];
      const Y = fabStatsNow(fabId).Y;
      const r = [nextRandom(s.rng), nextRandom(s.rng), nextRandom(s.rng), nextRandom(s.rng), nextRandom(s.rng)];
      cs.offers.push(Eco.makeContract(bal, fabId, s.res.rep, Y, r, cs.nextId++, day));
      bus.emit('contract:offer', { fabId });
      bus.emit('toast', `${bal.fabs[fabId].zh} 收到新的客戶訂單（到「市場與訂單」查看）`);
    }
    cs.nextOfferDay = day + cfg.gapMin + Math.floor(nextRandom(s.rng) * (cfg.gapMax - cfg.gapMin + 1));
  }
}

function settleDay(s, bal) {
  const day = s.clock.tick / bal.ticksPerDay;
  const r = s.res, m = bal.market;
  // 市場：價格指數（含偶發衝擊）與需求指數
  const shock = nextRandom(s.rng) < m.shockChance ? (nextRandom(s.rng) < 0.5 ? -1 : 1) * m.shockSize : 0;
  r.priceWalk = Eco.nextPriceWalk(bal, r.priceWalk, nextRandom(s.rng), shock);
  r.demandIdx = Eco.nextDemand(bal, r.demandIdx, nextRandom(s.rng));
  r.priceHist = [...(r.priceHist || []), r.priceWalk].slice(-m.histLen);
  let maint = 0, hold = 0;
  for (const fabId of bal.fabOrder) {
    const fab = s.fabs[fabId];
    r.soldToday[fabId] = 0;
    if (!fab.unlocked) continue;
    hold += Eco.holdCost(bal, fabId, r.inv[fabId]);       // 倉儲成本
    if (r.inv[fabId] > 0) r.invAge[fabId] = (r.invAge[fabId] || 0) + 1; // 庫存變老
    else r.invAge[fabId] = 0;
    maint += bal.fabs[fabId].maintenance;
    if (r.inv[fabId] >= bal.invCap * 0.8) bus.emit('toast', `${bal.fabs[fabId].zh} 庫存快滿了（${r.inv[fabId]} / ${bal.invCap}），記得賣出！`);
  }
  hold = Math.round(hold);
  r.money -= maint + hold;
  if (r.money < 0) { r.money = 0; addRep(-1); bus.emit('toast', '維運費付不出來，聲望 -1'); }
  contractsDay(s, bal, day);
  addRep(Eco.clamp(r.repAcc, -bal.rep.dailyCap, bal.rep.dailyCap));
  r.repAcc = 0;

  const triggered = [];
  for (const fabId of bal.fabOrder) {
    const fab = s.fabs[fabId];
    if (!fab.unlocked) continue;
    const ended = Ev.tickEventDay(fab);
    if (ended) bus.emit('event:end', { fabId });
  }
  for (const t of Ev.rollDailyEvents(s, bal, day)) {
    triggered.push(Ev.triggerEvent(s, bal, t.fabId, t.id, addRep));
  }
  save();
  bus.emit('day', { day, maint, hold });
  for (const t of triggered) bus.emit('event:trigger', { fabId: t.fabId, id: t.id });
}

export function stepTick() {
  const s = getState(), bal = getBal();
  s.clock.tick += 1;
  for (const fabId of bal.fabOrder) {
    const fab = s.fabs[fabId];
    if (fab.unlocked) advanceFab(s, bal, fabId, fab);
  }
  if (s.clock.tick % bal.ticksPerDay === 0) settleDay(s, bal);
  bus.emit('tick', { tick: s.clock.tick });
}
