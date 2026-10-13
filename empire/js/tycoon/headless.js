// 無頭模擬（Node）：用真正的 state / sim 跑「簡單貪婪策略」，量測節奏。
//   node js/tycoon/headless.js [天數] [種子]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as S from './state.js';
import * as Eco from './economy.js';
import * as Sim from './sim.js';
import * as Ev from './events.js';
import { setEventDefs } from './events.js';

export function loadBalance() {
  return JSON.parse(readFileSync(fileURLToPath(new URL('../../data/balance.json', import.meta.url)), 'utf8'));
}
export function loadEvents() {
  return JSON.parse(readFileSync(fileURLToPath(new URL('../../data/events.json', import.meta.url)), 'utf8'));
}

/** 貪婪玩家：買最便宜機台、依回本天數升級瓶頸、價格好或庫存舊時賣出、接得起的訂單就接、有錢就開新廠。
 *  解謎假設每關 2 星（開廠時視為已解完）。 */
export function runGreedy({ days = 80, seed = 12345, policy = {} } = {}) {
  const pol = { reserve: 1500, payback: 14, sellAbove: 0.97, maxAge: 3, ...policy };
  const bal = loadBalance();
  setEventDefs(loadEvents());
  S.initState(bal, { fresh: true });
  const st = S.getState();
  st.rng.seed = seed >>> 0;
  st.tutorial.done.push('t-event');
  for (let i = 1; i <= bal.fabs.f1.puzzleLevels; i++) st.puzzle.stars['f1-' + i] = 2; // 教學期解完 Fab 1
  const log = { affordable: {}, unlocked: {}, money: [], contractsDone: 0, contractsFailed: 0, upgrades: 0 };
  const origToast = null;
  const yNow = f => Sim.fabStatsNow(f).Y;
  let penaltyCount = 0;

  const act = day => {
    const s = S.getState();
    for (const fabId of bal.fabOrder) {
      const fab = s.fabs[fabId];
      if (!fab.unlocked) continue;
      // 1. 買缺的機台（最便宜）
      fab.slots.forEach((sl, i) => {
        if (sl) return;
        const ids = Eco.allowedEquip(bal, fabId, i).sort((a, b) => Eco.equipPrice(bal, fabId, a) - Eco.equipPrice(bal, fabId, b));
        if (s.res.money >= Eco.equipPrice(bal, fabId, ids[0]) + (fabId === 'f1' ? 0 : Eco.lotCost(bal, fabId))) S.buyEquip(fabId, i, ids[0]);
      });
      if (!fab.slots.every(Boolean)) continue;
      // 2. 訂單
      const cs = s.res.contracts;
      for (const c of [...cs.active]) { const r = S.deliverContract(c.id, yNow(c.fabId)); if (r.ok) log.contractsDone++; }
      for (const o of [...cs.offers]) {
        if (o.fabId !== fabId) continue;
        const proj = Eco.lineProjection(bal, fabId, fab, S.starRatio(fabId), Sim.fabMods(fabId), s.res.rep, 1, 1);
        const can = s.res.inv[fabId] + proj.goodPerDay * (o.days - 1) * 0.9 >= o.qty && yNow(fabId) >= o.minY;
        if (can && s.res.money > Eco.lotCost(bal, fabId) * 4 && cs.active.length < bal.contracts.maxActive) S.acceptContract(o.id); else S.declineContract(o.id);
      }
      // 3. 賣出：價格好、庫存舊、庫存太多才賣；訂單在手就留貨
      const reserved = cs.active.filter(c => c.fabId === fabId).reduce((a, c) => a + c.qty, 0);
      const broke = s.res.money < Eco.lotCost(bal, fabId) * 2;
      const sellable = Math.max(0, s.res.inv[fabId] - (broke ? 0 : reserved));
      if (sellable > 0 && (s.res.priceWalk >= pol.sellAbove || s.res.invAge[fabId] >= pol.maxAge || s.res.inv[fabId] > bal.startHaltInv * 0.7 || s.res.money < Eco.lotCost(bal, fabId) * 3))
        S.sellInventory(fabId, Math.min(sellable, S.sellRoom(fabId)));
      // 4. 升級：選回本最快者
      let best = null;
      const base = Eco.lineProjection(bal, fabId, fab, S.starRatio(fabId), Sim.fabMods(fabId), s.res.rep, 1, 1);
      fab.slots.forEach((sl, i) => {
        const cost = S.upgradeCostOf(fabId, i);
        if (cost == null || s.res.money - cost < pol.reserve * Eco.fabMult(bal, fabId)) return;
        const alt = { ...fab, slots: fab.slots.map((x, k) => (k === i ? { ...x, level: x.level + 1 } : x)) };
        const p = Eco.lineProjection(bal, fabId, alt, S.starRatio(fabId), Sim.fabMods(fabId), s.res.rep, 1, 1);
        const gain = p.profitPerDay - base.profitPerDay;
        if (gain > 0 && cost / gain <= pol.payback && (!best || cost / gain < best.pb)) best = { i, pb: cost / gain };
      });
      if (best && S.upgradeEquip(fabId, best.i).ok) log.upgrades++;
      // 5. 事件：粒子且有錢就清洗；故障且有錢就修
      const ev = fab.event;
      if (ev?.id === 'tool_failure' && s.res.money > Ev.repairCost(bal, fabId, fab) + Eco.lotCost(bal, fabId)) Ev.chooseOption(s, bal, fabId, 'repair', S.spend);
      if (ev?.id === 'particle' && s.res.money > Ev.cleanCost(bal, fabId) + Eco.lotCost(bal, fabId) * 3) Ev.chooseOption(s, bal, fabId, 'clean', S.spend);
      if (ev?.id === 'rush_order' && !ev.extra.accepted) { ev.extra.accepted = true; ev.extra.pending = true; }
    }
    // 6. 開廠（星數視為已解）
    for (const fabId of bal.fabOrder) {
      if (s.fabs[fabId].unlocked) continue;
      const f = bal.fabs[fabId];
      if (s.res.money >= f.unlockMoney && s.res.rep >= f.unlockRep && log.affordable[fabId] == null) log.affordable[fabId] = day;
      // 玩家會多留一筆錢買機台與投片，否則開了廠也轉不動
      const kit = bal.fabs[fabId].slots.reduce((a, _, i) => a + Math.min(...Eco.allowedEquip(bal, fabId, i).map(e => Eco.equipPrice(bal, fabId, e))), 0);
      if (s.res.money >= f.unlockMoney + kit + Eco.lotCost(bal, fabId) * 2 && s.res.rep >= f.unlockRep) {
        log.ready = log.ready || {}; log.ready[fabId] = day;
        for (let i = 1; i <= f.puzzleLevels; i++) s.puzzle.stars[`${fabId}-${i}`] = 2;
        S.unlockFab(fabId); log.unlocked[fabId] = day;
      }
      break; // 一次只看下一座
    }
  };

  for (let d = 0; d < days; d++) {
    act(d + 1);
    for (let t = 0; t < bal.ticksPerDay; t++) Sim.stepTick();
    if (policy.trace) { const q = S.getState(); console.log(d + 1, 'money', Math.round(q.res.money), 'inv', q.res.inv.f1, 'age', (q.res.invAge.f1||0).toFixed(1), 'px', q.res.priceWalk.toFixed(2), 'Y', Sim.fabStatsNow('f1').Y.toFixed(3), 'ev', q.fabs.f1.event?.id || '-', 'rep', q.res.rep.toFixed(1), 'ct', q.res.contracts.active.length); }
    if ((d + 1) % 10 === 0) log.money.push([d + 1, Math.round(S.getState().res.money), +S.getState().res.rep.toFixed(1)]);
  }
  log.final = { money: Math.round(S.getState().res.money), rep: S.getState().res.rep };
  return log;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const days = +process.argv[2] || 80, seed = +process.argv[3] || 12345;
  console.log(JSON.stringify(runGreedy({ days, seed }), null, 1));
}
