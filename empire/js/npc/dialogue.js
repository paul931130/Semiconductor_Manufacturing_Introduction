// 對話引擎：載入 dialogue.json、排隊、節流、模式（完整／精簡）、與遊戲狀態的銜接。
// 優先度：0 閒聊 chat、1 一般 normal、2 重要 important（精簡模式也顯示）、3 阻擋 block（事件選項）。
import { bus } from '../shared/bus.js';
import * as S from '../tycoon/state.js';
import { getFactText } from '../shared/content.js';
import { createBox } from './box.js';

let DATA = null;
let box = null;
let probes = { tutorialActive: () => false };

const PRI = { chat: 0, normal: 1, important: 2, block: 3 };
const queue = [];
let showing = null;
let pumpTimer = 0;
let lastEndAt = 0;          // 真實時間（ms）
let lastLineTick = -9999;   // 遊戲 tick
const cds = new Map();      // key → 上次說的 tick（不存檔）

export function setProbes(p) { probes = { ...probes, ...p }; }

export async function loadDialogue() {
  const res = await fetch(new URL('../../data/dialogue.json', import.meta.url));
  if (!res.ok) throw new Error('dialogue-load-failed');
  DATA = await res.json();
  if (!box) {
    box = createBox();
    bus.on('state:reset', () => { cds.clear(); queue.length = 0; if (box.isOpen()) box.dismiss('reset'); });
  }
  return DATA;
}
export const hasDialogue = () => !!DATA;
export const npcInfo = id => DATA?.npcs?.[id] || { name: '?', title: '' };
export const hasLine = id => !!DATA?.lines?.[id];

// ---------- 文字樣板 ----------
const fmt = (s, vars) => s.replace(/\{([^{}]+)\}/g, (m, k) => (k.startsWith('fact#') ? getFactText(k) : (vars?.[k] ?? '')));
const pick = a => a[Math.floor(Math.random() * a.length)]; // 介面用隨機，不碰遊戲 rng

/** 取得一句台詞：{ id, npc, x, pages:[{t,x,k}], factIds } */
export function resolveLine(id, vars = {}) {
  const def = DATA?.lines?.[id];
  if (!def) return null;
  const pool = def.alt ? [def.t, ...def.alt] : [def.t];
  const t = pick(pool);
  const factIds = [];
  const pages = [];
  for (const pg of [t].flat()) {
    const o = typeof pg === 'string' ? { t: pg } : pg;
    if (o.if) {
      const neg = o.if.startsWith('!');
      const v = !!vars[neg ? o.if.slice(1) : o.if];
      if (neg ? v : !v) continue;
    }
    for (const m of o.t.matchAll(/\{(fact#\d+)\}/g)) factIds.push(m[1]);
    const txt = fmt(o.t, vars).trim();
    if (txt) pages.push({ t: txt, x: o.x, k: /^\{fact#\d+\}$/.test(o.t.trim()) ? 1 : 0 });
  }
  return { id, npc: def.npc, x: def.x || 'normal', pages, factIds, pri: PRI[def.pri] ?? 1 };
}
/** 給教學用：回傳單一字串（多頁以空白連接） */
export function lineText(id, vars) {
  const l = resolveLine(id, vars);
  return l ? { npc: l.npc, x: l.x, text: l.pages.map(p => p.t).join('') } : { npc: 'facility', x: 'normal', text: '' };
}

// ---------- 模式、持久旗標 ----------
export const getMode = () => (S.getState()?.settings?.npcMode === 'lite' ? 'lite' : 'full');
export function setMode(m) { S.setSetting('npcMode', m === 'lite' ? 'lite' : 'full'); bus.emit('npc:mode', { mode: getMode() }); }
const doneList = () => S.getState().tutorial.done;
export const flag = k => doneList().includes('npc:' + k);
export function setFlag(k) { if (!flag(k)) { doneList().push('npc:' + k); S.save(); } }
export const nowTick = () => S.getState()?.clock?.tick ?? 0;
const ticksPerDay = () => S.getBal()?.ticksPerDay ?? 24;

// ---------- 說話 ----------
/**
 * say(id, opts) → 'shown'|'queued'|'throttled'|'dropped'|'missing'
 * opts: vars, key+cd（同 key 在 cd 遊戲日內不重說）, once（持久旗標）, pri（覆蓋）, force（略過全域間隔）,
 *       ttl（被擋住時最多等幾 ms 就作廢；重要訊息預設不作廢，時效性警告要自己給 ttl）
 */
export function say(id, opts = {}) {
  if (!DATA || !S.getState()) return 'missing';
  const line = resolveLine(id, opts.vars || {});
  if (!line || !line.pages.length) return 'missing';
  const pri = opts.pri != null ? (PRI[opts.pri] ?? opts.pri) : line.pri;
  if (pri < 2 && getMode() === 'lite') return 'dropped';
  if (opts.once && flag(opts.once)) return 'throttled';
  const tick = nowTick();
  if (opts.key && opts.cd != null && cds.has(opts.key) && tick - cds.get(opts.key) < opts.cd * ticksPerDay()) return 'throttled';
  if (pri < 2 && !opts.force) {
    const gap = pri === 0 ? 48 : 20;
    if (tick - lastLineTick < gap) return 'dropped';
    if (pri === 0 && (queue.length || showing)) return 'dropped';
  }
  if (queue.some(q => q.id === id)) return 'throttled';
  if (probes.tutorialActive() && pri < 3 && (pri < 2 || Number.isFinite(opts.ttl))) return 'dropped'; // 教學進行中：只保留不會過期的重要訊息（開廠、解謎完成等）
  const info = npcInfo(line.npc);
  const item = {
    id, npc: line.npc, x: line.x, pages: line.pages, factIds: line.factIds, pri,
    name: info.name, title: info.title, block: pri >= 3,
    ttlAt: Date.now() + (opts.ttl ?? (pri >= 2 ? Infinity : 20000))
  };
  return enqueue(item, opts);
}

/** 阻擋式（事件選項）：build({close}) 回傳要放進對話框的節點。回傳 Promise<reason> */
export function presentBlocking({ id, vars, build, label, npc, x }) {
  const line = resolveLine(id, vars || {});
  const lnpc = npc || line?.npc || 'facility';
  const info = npcInfo(lnpc);
  return new Promise(resolve => {
    const item = {
      id, npc: lnpc, x: x || line?.x || 'normal',
      pages: line?.pages?.length ? line.pages : [{ t: '…' }], factIds: line?.factIds || [], pri: 3, block: true,
      name: info.name, title: info.title, label, ttlAt: Infinity,
      build, resolve
    };
    enqueue(item, {});
  });
}

function enqueue(item, opts) {
  if (opts.key) cds.set(opts.key, nowTick());
  if (opts.once) setFlag(opts.once);
  // 同優先度 FIFO；高優先度排前面
  let i = queue.length;
  while (i > 0 && queue[i - 1].pri < item.pri) i--;
  queue.splice(i, 0, item);
  // 非重要的最多留 3 句
  const soft = queue.filter(q => q.pri < 2);
  if (soft.length > 3) queue.splice(queue.indexOf(soft[0]), 1);
  // 重要／阻擋可打斷正在顯示的低優先度句子
  if (showing && showing.pri < item.pri && item.pri >= 2) box.dismiss('preempt');
  const wasIdle = !showing;
  pump();
  return wasIdle && showing === item ? 'shown' : 'queued';
}

const overlayOpen = () => !!document.querySelector('.ty-overlay, .pz-overlay, .pz-result-back, .pz-sheet-back');
const gameHidden = () => !!document.getElementById('screen-game')?.hidden;

function blocked(item) {
  if (item.pri >= 3) return false;
  if (document.hidden || gameHidden()) return true;
  if (probes.tutorialActive()) return true;
  return overlayOpen();
}

function pump() {
  clearTimeout(pumpTimer);
  if (showing) return;
  const now = Date.now();
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (q.ttlAt < now || (probes.tutorialActive() && q.pri < 2)) queue.splice(i, 1);
  }
  const idx = queue.findIndex(q => !blocked(q));
  if (idx < 0) {
    if (queue.length) pumpTimer = setTimeout(pump, 600);
    return;
  }
  // 兩句之間留一點呼吸（阻擋式除外）
  const wait = queue[idx].pri >= 3 ? 0 : Math.max(0, lastEndAt + 450 - now);
  if (wait > 0) { pumpTimer = setTimeout(pump, wait); return; }
  const item = queue.splice(idx, 1)[0];
  showing = item;
  for (const f of item.factIds || []) { try { S.markFactSeen(f); } catch (e) { /* ignore */ } }
  box.present(item).then(reason => {
    showing = null;
    lastEndAt = Date.now();
    lastLineTick = nowTick();
    item.resolve?.(reason);
    pump();
  });
}

export const isBusy = () => !!showing || queue.length > 0;
export const wake = () => pump();
bus.on('tutorial:end', () => setTimeout(pump, 300));
export const lineIds = prefix => Object.keys(DATA?.lines || {}).filter(k => k.startsWith(prefix));
