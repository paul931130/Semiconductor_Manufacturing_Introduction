// 打字機效果：以「隱形完整文字 + 逐字顯示」疊放，避免版面隨打字跳動。
import * as S from '../tycoon/state.js';

export function reducedMotion() {
  let pref = false;
  try { pref = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
  let setting = false;
  try { setting = !!S.getState()?.settings?.reduceMotion; } catch (e) { /* ignore */ }
  return pref || setting;
}

/**
 * 在 node 中逐字顯示 text。回傳 { finish(), cancel(), done }。
 * 螢幕閱讀器請另行提供 aria-live 的完整文字；這裡的節點會標 aria-hidden。
 */
export function typewrite(node, text, { instant = false, cps = 36, onDone } = {}) {
  node.textContent = '';
  const ghost = document.createElement('span');
  ghost.className = 'npc-ghost';
  ghost.textContent = text;
  const live = document.createElement('span');
  live.className = 'npc-live';
  node.append(ghost, live);
  const chars = Array.from(text);
  const ctrl = { done: false, finish, cancel };
  let i = 0, timer = 0;
  function end(fire) {
    if (ctrl.done) return;
    ctrl.done = true;
    clearInterval(timer);
    live.textContent = text;
    if (fire) onDone?.();
  }
  function finish() { end(true); }
  function cancel() { ctrl.done = true; clearInterval(timer); }
  if (instant || reducedMotion() || !chars.length) {
    end(true);
    return ctrl;
  }
  const step = chars.length > 90 ? 3 : chars.length > 45 ? 2 : 1;
  timer = setInterval(() => {
    i = Math.min(chars.length, i + step);
    live.textContent = chars.slice(0, i).join('');
    if (i >= chars.length) end(true);
  }, Math.round(1000 / cps));
  return ctrl;
}
