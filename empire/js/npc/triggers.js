// 把既有的系統訊息（事件以外）接到 NPC：訂單、首次銷售、資金／庫存警告、開廠、解謎組完成、瓶頸變化、聲望里程碑、閒聊。
// 只讀遊戲狀態、只聽 bus；不改任何遊戲邏輯。節流規則見 dialogue.js（cd 單位是遊戲日）。
import { bus } from '../shared/bus.js';
import * as S from '../tycoon/state.js';
import * as Eco from '../tycoon/economy.js';
import { fabStatsNow, fabMods } from '../tycoon/sim.js';
import { money } from '../tycoon/ui.js';
import { say, lineText, lineIds, flag, setFlag, nowTick, getMode } from './dialogue.js';

const bal = () => S.getBal();
const st = () => S.getState();
const fabName = id => bal().fabs[id].zh;
const slotName = (fabId, i) => bal().categories[bal().fabs[fabId].slots[i]] || '';
const WARN_TTL = 60000; // 時效性警告：被擋住超過一分鐘就作廢
const handled = r => r === 'shown' || r === 'queued' || r === 'throttled';
const day0 = () => Math.floor(nowTick() / bal().ticksPerDay);

let probes = { tutorialActive: () => false };
let lastOfferHandled = false;
const dlWarned = new Set();      // 訂單交期提醒（不存檔）
const emptyDays = {};            // 空槽連續天數
const bnKey = {};                // 各廠瓶頸簽章
const pzSnap = {};               // 解謎前星數快照
const recentChat = [];
let nextChatTick = 0;

export function setTriggerProbes(p) { probes = { ...probes, ...p }; }

// ---------- 訂單 ----------
function contractVars(o) {
  const b = bal(), s = st();
  const yNow = fabStatsNow(o.fabId).Y;
  const short = yNow < o.minY;
  return {
    fab: fabName(o.fabId), qty: o.qty, price: '$' + Math.round(o.unitPrice * 10) / 10, total: money(Eco.contractPayout(o)),
    prem: Math.round((o.premium - 1) * 100), minY: Math.round(o.minY * 100), days: o.days,
    left: o.offerEnd - Math.floor(s.clock.tick / b.ticksPerDay), yNow: (yNow * 100).toFixed(1), pen: money(o.penalty),
    warn: short, stretch: !!o.stretch
  };
}

function onOffer() {
  const o = st().res.contracts.offers.at(-1);
  lastOfferHandled = false;
  if (!o) return;
  lastOfferHandled = handled(say('contract.offer', { vars: contractVars(o) }));
}

function deadlines(day) {
  const b = bal();
  for (const c of st().res.contracts.active) {
    const left = c.deadline - day;
    if (left > 2 || left < 1) continue;
    const k = c.id + ':' + left;
    if (dlWarned.has(k)) continue;
    dlWarned.add(k);
    const chk = S.contractCheck(c, fabStatsNow(c.fabId).Y);
    const kind = chk.stockOk && chk.yieldOk ? 'ok' : !chk.stockOk && !chk.yieldOk ? 'both' : !chk.stockOk ? 'stock' : 'yield';
    const sv = { short: Math.max(0, c.qty - chk.have), yNow: (chk.yNow * 100).toFixed(1), minY: Math.round(c.minY * 100) };
    const status = lineText('contract.status.' + kind, sv).text;
    say(left <= 1 ? 'contract.deadline.1' : 'contract.deadline.2', {
      ttl: WARN_TTL,
      vars: { fab: fabName(c.fabId), qty: c.qty, left, status, pen: money(c.penalty), repLoss: b.contracts.repLoss }
    });
  }
}

// ---------- 營運警告 ----------
function ops(day) {
  const b = bal(), s = st();
  let brokeSaid = false;
  let totalMaint = 0;
  for (const fabId of b.fabOrder) {
    const fab = s.fabs[fabId];
    if (!fab.unlocked) continue;
    totalMaint += b.fabs[fabId].maintenance;
    const complete = fab.slots.every(Boolean);
    if (!complete) {
      emptyDays[fabId] = (emptyDays[fabId] || 0) + 1;
      if (emptyDays[fabId] >= 4 && !probes.tutorialActive()) {
        const i = fab.slots.findIndex(x => !x);
        say('ops.emptyslot', { ttl: WARN_TTL, key: 'empty:' + fabId, cd: 14, vars: { fab: fabName(fabId), slot: slotName(fabId, i) } });
      }
      continue;
    }
    emptyDays[fabId] = 0;
    const inv = s.res.inv[fabId];
    const lot = Eco.lotCost(b, fabId);
    if (inv >= b.startHaltInv) {
      say('ops.invhalt', { ttl: WARN_TTL, key: 'invhalt:' + fabId, cd: 8, vars: { fab: fabName(fabId), inv, halt: b.startHaltInv, cap: b.invCap } });
    } else if (s.res.money < lot && !fab.lots.length) {
      brokeSaid = true;
      brokeLine(fabId);
    }
    const stt = fabStatsNow(fabId);
    if (stt.complete && stt.Y < stt.breakEven - 0.005) {
      const S_ = S.starRatio(fabId), ed = fabMods(fabId).eventDef;
      let worst = 0, wy = 9;
      fab.slots.forEach((sl, i) => { const y = Eco.slotYield(b, fabId, sl.equip, sl.level, S_, ed); if (y < wy) { wy = y; worst = i; } });
      say('ops.yieldbelow', { ttl: WARN_TTL, key: 'ybelow:' + fabId, cd: 10, vars: {
        fab: fabName(fabId), Y: (stt.Y * 100).toFixed(1), be: (stt.breakEven * 100).toFixed(0), slot: slotName(fabId, worst), yy: (wy * 100).toFixed(1) } });
    }
  }
  if (!brokeSaid && totalMaint > 0 && s.res.money < totalMaint * 1.1 && s.res.money >= 0) {
    say('ops.lowcash', { ttl: WARN_TTL, key: 'lowcash', cd: 10, vars: { money: money(s.res.money), maint: money(totalMaint) } });
  }
}
function brokeLine(fabId) {
  const b = bal(), s = st();
  const inv = s.res.inv[fabId];
  return say(inv > 0 ? 'ops.broke.sell' : 'ops.broke.nostock', {
    ttl: WARN_TTL, key: 'broke:' + fabId, cd: 8, vars: { fab: fabName(fabId), money: money(s.res.money), lot: money(Eco.lotCost(b, fabId)), inv }
  });
}

/** hud 的 toast 交給 NPC 轉述；回傳 true 表示已由 NPC 處理（hud 不再顯示 toast） */
export function claimToast(msg) {
  try {
    const b = bal(), s = st();
    if (!b || !s || typeof msg !== 'string') return false;
    const fabId = b.fabOrder.find(f => msg.includes(b.fabs[f].zh));
    if (/收到新的客戶訂單/.test(msg)) return lastOfferHandled;
    if (/訂單逾期未交貨/.test(msg)) {
      const m = msg.match(/違約金 -\$([\d,]+)/);
      return handled(say('contract.late', { ttl: WARN_TTL, vars: { pen: '$' + (m ? m[1] : '0') } }));
    }
    if (/庫存快滿了/.test(msg) && fabId) {
      return handled(say('ops.invfull', { ttl: WARN_TTL, key: 'invfull:' + fabId, cd: 6, vars: { fab: fabName(fabId), inv: s.res.inv[fabId], cap: b.invCap, halt: b.startHaltInv } }));
    }
    if (/資金不足，無法投片/.test(msg)) {
      const f = b.fabOrder.find(x => s.fabs[x].unlocked && s.fabs[x].slots.every(Boolean) && s.res.money < Eco.lotCost(b, x)) || 'f1';
      return handled(brokeLine(f));
    }
    if (/維運費付不出來/.test(msg)) {
      return handled(say('ops.maintfail', { ttl: WARN_TTL, key: 'maintfail', cd: 6, vars: { money: money(s.res.money) } }));
    }
  } catch (e) { console.error('[npc] claimToast', e); }
  return false;
}

// ---------- 瓶頸 ----------
function bottlenecks() {
  const b = bal(), s = st();
  for (const fabId of b.fabOrder) {
    const fab = s.fabs[fabId];
    if (!fab.unlocked) continue;
    const stt = fabStatsNow(fabId);
    const key = stt.complete ? stt.bottlenecks.join(',') : 'x';
    const prev = bnKey[fabId];
    bnKey[fabId] = key;
    if (prev == null || prev === 'x' || key === 'x' || prev === key || probes.tutorialActive()) continue;
    const bs = stt.bottlenecks;
    if (bs.length > 1) {
      say('ops.bottleneck.multi', { ttl: WARN_TTL, key: 'bn:' + fabId, cd: 3, vars: { fab: fabName(fabId), n: bs.length, slots: bs.map(i => slotName(fabId, i)).join('、') } });
    } else {
      say('ops.bottleneck', { ttl: WARN_TTL, key: 'bn:' + fabId, cd: 3, vars: { fab: fabName(fabId), slot: slotName(fabId, bs[0]), h: stt.hours[bs[0]].toFixed(1) } });
    }
  }
}
let bnTimer = 0;

// ---------- 聲望里程碑 ----------
const REP_MARKS = [15, 30, 50, 70, 90];
function repBaseline() {
  if (flag('rep-init')) return;
  const r = st().res.rep;
  for (const m of REP_MARKS) if (r >= m) setFlag('rep:' + m);
  setFlag('rep-init');
}
function repMilestones() {
  const r = st().res.rep;
  for (const m of REP_MARKS) {
    if (r >= m && !flag('rep:' + m)) {
      setFlag('rep:' + m);
      say('rep.m' + m, { vars: { rep: Math.floor(r) }, pri: 'important' });
      break;
    }
  }
}

// ---------- 市場 ----------
function market() {
  const s = st();
  const inv = S.totalInventory();
  if (inv <= 0) return;
  const w = s.res.priceWalk;
  if (w >= 1.15) say('market.hot', { key: 'mkt', cd: 12, vars: { idx: w.toFixed(2) } });
  else if (w <= 0.88) say('market.cold', { key: 'mkt', cd: 12, vars: { idx: w.toFixed(2) } });
}

// ---------- 閒聊 ----------
function chatter(day) {
  if (day < 4 || probes.tutorialActive() || getMode() === 'lite') return;
  const t = nowTick();
  if (t < nextChatTick) return;
  const ids = lineIds('chat.').filter(i => !recentChat.includes(i));
  if (!ids.length) { recentChat.length = 0; return; }
  const id = ids[Math.floor(Math.random() * ids.length)];
  const r = say(id, { pri: 'chat' });
  if (r === 'shown' || r === 'queued') {
    recentChat.push(id);
    if (recentChat.length > 14) recentChat.shift();
    nextChatTick = t + (5 + Math.floor(Math.random() * 5)) * bal().ticksPerDay; // 5–9 遊戲日後再閒聊
  }
}

// ---------- 安裝 ----------
export function installTriggers() {
  const guard = (name, fn) => (...a) => { try { fn(...a); } catch (e) { console.error('[npc]', name, e); } };

  bus.on('contract:offer', guard('offer', onOffer));
  bus.on('contract:done', guard('done', ({ pay }) => { say('contract.done', { key: 'cdone', cd: 1, vars: { pay: money(pay) } }); }));
  bus.on('inv:sold', guard('sold', () => {
    if (flag('first-sale')) return;
    if (probes.tutorialActive()) { setFlag('first-sale'); return; } // 教學已經講過
    say('sale.first', { once: 'first-sale' });
  }));
  bus.on('fab:unlocked', guard('unlock', ({ fabId }) => { say('fab.unlocked.' + fabId, { pri: 'important' }); }));

  bus.on('puzzle:start', guard('pzstart', ({ fabId }) => {
    const stars = st().puzzle.stars;
    const mine = Object.entries(stars).filter(([k]) => k.startsWith(fabId + '-'));
    pzSnap[fabId] = { total: mine.reduce((a, [, n]) => a + n, 0), clear: S.unlockStatus(fabId).puzzle.ok };
  }));
  bus.on('puzzle:applied', guard('pzdone', ({ fabId }) => {
    const b = bal(), snap = pzSnap[fabId] || { total: 0, clear: false };
    const u = S.unlockStatus(fabId);
    const total = Object.entries(st().puzzle.stars).filter(([k]) => k.startsWith(fabId + '-')).reduce((a, [, n]) => a + n, 0);
    const max = b.fabs[fabId].puzzleLevels * 3;
    const r = S.starRatio(fabId);
    const vars = { fab: fabName(fabId), S: Math.round(r * 100), mul: (1 - b.yield.starHalf * r).toFixed(2), stars: total, max };
    if (S.isUnlocked(fabId)) {
      if (total > snap.total) say(total >= max ? 'puzzle.perfect' : 'puzzle.progress', { vars, key: 'pz:' + fabId, cd: 0 });
      return;
    }
    if (u.puzzle.ok && !snap.clear) {
      const needs = [];
      if (!u.money.ok) needs.push(lineText('puzzle.need.money', { m: money(u.money.need), have: money(u.money.have) }).text);
      if (!u.rep.ok) needs.push(lineText('puzzle.need.rep', { r: u.rep.need, have: u.rep.have.toFixed(1) }).text);
      say('puzzle.cleared', { pri: 'important', vars: { ...vars, need: needs.join('；'), needs: needs.length > 0, ready: needs.length === 0, perfect: total >= max } });
    } else if (total > snap.total) {
      say('puzzle.progress', { vars, key: 'pz:' + fabId, cd: 0 });
    }
  }));

  bus.on('state:changed', () => { clearTimeout(bnTimer); bnTimer = setTimeout(guard('bn', bottlenecks), 60); });
  bus.on('day', guard('day', ({ day }) => {
    deadlines(day);
    ops(day);
    repMilestones();
    market();
    chatter(day);
  }));
  bus.on('state:reset', () => {
    dlWarned.clear(); recentChat.length = 0; nextChatTick = 6 * bal().ticksPerDay;
    for (const k of Object.keys(bnKey)) delete bnKey[k];
    for (const k of Object.keys(emptyDays)) delete emptyDays[k];
    repBaseline();
  });
  repBaseline();
  nextChatTick = nowTick() + 6 * bal().ticksPerDay;
  setTimeout(guard('bn0', bottlenecks), 0); // 記錄初始瓶頸簽章
}
