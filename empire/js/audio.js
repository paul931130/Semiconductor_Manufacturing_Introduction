// WebAudio 合成音效（無音檔）：click / clear / star / alarm / purchase / ship。
// 另有「環境音」ambience（無塵室風扇、機台嗡聲、AMHS 軌道聲），音量與 SFX 分開（localStorage waferEmpire.ambience）。
// 靜音狀態存 localStorage（全部 try/catch；隱私模式下僅記憶體）。
import { bus } from './shared/bus.js';
const KEY = 'waferEmpire.mute';
const AKEY = 'waferEmpire.ambience';
let ctx = null;
let master = null;
let ambBus = null;
let muted = false;
let volume = () => 0.5;
let ambVol = 0.5;
let lastEv = null; // 最近一次事件類型：main.js 呼叫 sfx.alarm() 時依此決定警報層級
const listeners = new Set();

try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* ignore */ }
try {
  const a = localStorage.getItem(AKEY);
  if (a != null) { const n = Number(a); if (!Number.isNaN(n)) ambVol = Math.max(0, Math.min(1, n)); }
} catch (e) { /* ignore */ }
// 本模組先於 main.js 的 installAudio 註冊，所以 sfx.alarm() 被呼叫時 lastEv 已是新事件
bus.on('event:trigger', (p) => { lastEv = (p && p.id) || null; });

export const isMuted = () => muted;
export function onMuteChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setVolumeSource(fn) { volume = fn; }
export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
  for (const fn of [...listeners]) { try { fn(muted); } catch (e) { /* ignore */ } }
  syncAmb();
}
export const toggleMute = () => { setMuted(!muted); if (!muted) sfx.click(); return muted; };

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    ambBus = ctx.createGain();
    ambBus.gain.value = 0;
    ambBus.connect(ctx.destination);
  } catch (e) { ctx = null; }
  return ctx;
}

let gestured = false;
/** 須在使用者手勢內呼叫一次（pointerdown / keydown） */
export function unlockAudio() {
  gestured = true;
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().then(syncAmb, () => {});
  else syncAmb();
}

function tone(freq, at, dur, { type = 'sine', vol = 0.2, to = 0 } = {}) {
  const c = ctx;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function play(fn) {
  if (muted) return;
  const v = Math.max(0, Math.min(1, Number(volume()) || 0));
  if (v === 0) return;
  const c = ensure();
  if (!c || c.state !== 'running') return;
  try { master.gain.value = v; fn(); } catch (e) { /* ignore */ }
}

export const sfx = {
  click: () => play(() => tone(720, 0, 0.05, { type: 'square', vol: 0.08, to: 520 })),
  purchase: () => play(() => { tone(988, 0, 0.09, { type: 'square', vol: 0.12 }); tone(1319, 0.08, 0.2, { type: 'square', vol: 0.12 }); }),
  clear: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'triangle', vol: 0.2 })); }),
  star: (i = 0) => play(() => tone(1175 * Math.pow(1.122, i * 2), 0, 0.28, { type: 'sine', vol: 0.22, to: 1175 * Math.pow(1.122, i * 2) * 1.01 })),
  /** 出貨「叮」 */
  ship: () => play(() => { tone(1568, 0, 0.55, { type: 'sine', vol: 0.14 }); tone(2093, 0.03, 0.7, { type: 'sine', vol: 0.07 }); }),
  /** 分級警報：power_outage 警報器 / tool_failure 三短嗶 / particle 兩聲低嗶 / rush_order 叮咚 / 其他沿用舊音 */
  alarm: (kind) => {
    const k = kind || lastEv; lastEv = null;
    play(() => {
      if (k === 'power_outage') { for (let i = 0; i < 6; i++) tone(i % 2 ? 940 : 620, i * 0.45, 0.45, { type: 'sawtooth', vol: 0.1, to: i % 2 ? 620 : 940 }); }
      else if (k === 'tool_failure') { for (let i = 0; i < 3; i++) tone(1000, i * 0.14, 0.09, { type: 'square', vol: 0.09 }); }
      else if (k === 'particle') { tone(660, 0, 0.16, { type: 'triangle', vol: 0.12 }); tone(660, 0.24, 0.16, { type: 'triangle', vol: 0.12 }); }
      else if (k === 'rush_order') { tone(880, 0, 0.3, { type: 'sine', vol: 0.15 }); tone(659, 0.28, 0.5, { type: 'sine', vol: 0.15 }); }
      else for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, i * 0.16, 0.14, { type: 'sawtooth', vol: 0.1 });
    });
  },
};

// ---------------- 環境音（與 SFX 音量分開） ----------------
const HUM_F = [92, 110, 123, 147, 165, 185, 208, 233]; // 每個忙碌機台一條低頻嗡聲
const ambState = { on: false, busy: [], outage: false };
let amb = null;
let noiseBuf = null;
let lastWhoosh = 0;

function noiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // 近似棕噪
  noiseBuf = b; return b;
}
function buildAmb() {
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
  const fan = ctx.createGain(); fan.gain.value = 0;
  src.connect(lp); lp.connect(fan); fan.connect(ambBus);
  // 高頻氣流（HVAC / FFU）
  const src2 = ctx.createBufferSource(); src2.buffer = noiseBuffer(); src2.loop = true; src2.playbackRate.value = 1.7;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
  const air = ctx.createGain(); air.gain.value = 0;
  src2.connect(bp); bp.connect(air); air.connect(ambBus);
  const humLp = ctx.createBiquadFilter(); humLp.type = 'lowpass'; humLp.frequency.value = 420;
  humLp.connect(ambBus);
  const hums = HUM_F.map((f, i) => {
    const o = ctx.createOscillator(); o.type = i % 2 ? 'sine' : 'sawtooth'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(humLp); o.start(); return g;
  });
  src.start(); src2.start(ctx.currentTime, 0.7);
  amb = { fan, air, hums };
}
function ambLive() { return !!ctx && ctx.state === 'running' && ambState.on && !muted && ambVol > 0 && !document.hidden; }
function syncAmb() {
  if (!ctx || ctx.state !== 'running') return;
  try {
    if (!amb) buildAmb();
    const t = ctx.currentTime, out = ambState.outage;
    ambBus.gain.setTargetAtTime(ambLive() ? ambVol : 0, t, 0.3);
    amb.fan.gain.setTargetAtTime(out ? 0.015 : 0.11, t, out ? 0.8 : 0.5);   // 停電 → 風扇慢慢停
    amb.air.gain.setTargetAtTime(out ? 0 : 0.012, t, 0.5);
    amb.hums.forEach((g, i) => g.gain.setTargetAtTime(!out && ambState.busy[i] ? 0.0045 : 0, t, 0.4));
  } catch (e) { /* ignore */ }
}
// 分頁隱藏 → 環境音淡出並 suspend；回到分頁且曾有手勢 → resume
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) {
    ambBus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => { if (document.hidden && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 150);
  } else if (gestured && ctx.state === 'suspended') ctx.resume().then(syncAmb, () => {});
});

export const ambience = {
  /** st = { on:boolean, busy:boolean[]（每個槽是否在加工）, outage:boolean }；只記錄，需使用者手勢後才會發聲 */
  set(st) {
    const b = (st.busy || []).slice(0, HUM_F.length);
    const same = ambState.on === !!st.on && ambState.outage === !!st.outage && b.length === ambState.busy.length && b.every((v, i) => v === ambState.busy[i]);
    if (same) return;
    ambState.on = !!st.on; ambState.outage = !!st.outage; ambState.busy = b;
    syncAmb();
  },
  getVolume: () => ambVol,
  setVolume(v) {
    ambVol = Math.max(0, Math.min(1, Number(v) || 0));
    try { localStorage.setItem(AKEY, String(ambVol)); } catch (e) { /* ignore */ }
    syncAmb();
  },
  /** AMHS 天車移動時的軌道「咻」聲 */
  whoosh() {
    if (!ambLive()) return;
    const now = ctx.currentTime;
    if (now - lastWhoosh < 0.25) return;
    lastWhoosh = now;
    try {
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, now); f.frequency.exponentialRampToValueAtTime(1900, now + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.5, now + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      s.connect(f); f.connect(g); g.connect(ambBus);
      s.start(now, Math.random() * 1.2, 0.55);
    } catch (e) { /* ignore */ }
  }
};
