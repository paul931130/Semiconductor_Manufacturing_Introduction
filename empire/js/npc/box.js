// 對話框元件：畫面底部，頭像 + 名字 + 打字機文字；點一下跳過打字／下一句；可排隊（由 dialogue.js 管理）。
// 非阻擋（minor）：自動前進並消失、不搶焦點；阻擋（block）：事件選項，鎖焦點、需按選項。
import { portraitSvg } from './portraits.js';
import { typewrite, reducedMotion } from './type.js';

const h = (tag, cls, attrs) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export function createBox() {
  const root = h('div', 'npc-root', { hidden: '' });
  const scrim = h('div', 'npc-scrim');
  const card = h('section', 'npc-card', { 'aria-label': 'NPC 對話' });
  const pt = h('div', 'npc-pt');
  const main = h('div', 'npc-main');
  const head = h('div', 'npc-head');
  const nameEl = h('span', 'npc-name');
  const roleEl = h('span', 'npc-role');
  const closeBtn = h('button', 'npc-x', { type: 'button', 'aria-label': '略過這段對話' });
  closeBtn.textContent = '×';
  head.append(nameEl, roleEl, closeBtn);
  const textWrap = h('div', 'npc-textwrap');
  const text = h('div', 'npc-text', { 'aria-hidden': 'true' });
  const more = h('span', 'npc-more', { 'aria-hidden': 'true' });
  more.textContent = '▼';
  const adv = h('button', 'npc-adv', { type: 'button' });
  const sr = h('span', 'npc-sr', { 'aria-live': 'polite' });
  textWrap.append(text, more, adv);
  const extra = h('div', 'npc-extra');
  main.append(head, textWrap, extra);
  card.append(pt, main, sr);
  root.append(scrim, card);
  document.body.append(root);

  let cur = null; // { item, idx, typing, resolve, timer, hold }
  let prevFocus = null, lastKey = '';

  const isBlock = () => !!cur?.item.block;

  function setPortrait(npc, x) {
    const key = npc + '|' + x;
    if (key === lastKey) return;
    lastKey = key;
    pt.innerHTML = portraitSvg(npc, x);
  }
  function syncHeight() {
    const hh = root.hidden ? 0 : Math.ceil(card.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--npc-h', hh + 'px');
    document.body.classList.toggle('npc-open', !root.hidden);
  }

  function clearTimer() { if (cur) { clearTimeout(cur.timer); cur.timer = 0; } }
  function dwell(t) {
    const base = 1300 + 105 * Array.from(t).length;
    return Math.max(2600, cur.item.pri >= 2 ? base * 1.6 : base);
  }
  function schedule() {
    if (!cur || isBlock()) return;
    clearTimer();
    if (cur.hold || document.hidden) return;
    const last = cur.idx >= cur.item.pages.length - 1;
    cur.timer = setTimeout(() => { if (last) close('auto'); else next(); }, dwell(cur.item.pages[cur.idx].t) + (last ? 900 : 0));
  }

  function showPage(i) {
    cur.idx = i;
    const pg = cur.item.pages[i];
    const last = i >= cur.item.pages.length - 1;
    setPortrait(cur.item.npc, pg.x || cur.item.x || 'normal');
    card.classList.toggle('is-fact', !!pg.k);
    card.classList.remove('is-typed');
    more.hidden = true;
    sr.textContent = '';
    clearTimer();
    cur.typing?.cancel();
    cur.typing = typewrite(text, pg.t, {
      onDone: () => {
        card.classList.add('is-typed');
        sr.textContent = (i === 0 ? cur.item.name + '：' : '') + pg.t;
        more.hidden = last;
        adv.setAttribute('aria-label', last ? (isBlock() ? '對話文字' : '關閉對話') : '下一句');
        schedule();
        syncHeight();
      }
    });
    syncHeight();
  }

  function next() {
    if (!cur) return;
    if (cur.typing && !cur.typing.done) { cur.typing.finish(); return; }
    if (cur.idx < cur.item.pages.length - 1) showPage(cur.idx + 1);
    else if (!isBlock()) close('done');
  }

  function close(reason = 'done') {
    if (!cur) return;
    const c = cur;
    cur = null;
    clearTimeout(c.timer);
    c.typing?.cancel();
    root.hidden = true;
    root.classList.remove('is-block', 'is-in');
    extra.replaceChildren();
    document.removeEventListener('keydown', onKey, true);
    syncHeight();
    if (c.item.block && prevFocus) { try { prevFocus.focus?.(); } catch (e) { /* ignore */ } }
    prevFocus = null;
    c.resolve(reason);
  }

  function onKey(e) {
    if (!cur) return;
    if (e.key === 'Escape' && !isBlock()) { e.stopPropagation(); close('skip'); return; }
    if (e.key === 'Tab' && isBlock()) {
      const f = [...card.querySelectorAll('button:not([disabled]),[href],input,select,textarea')].filter(x => x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  }

  adv.addEventListener('click', () => next());
  textWrap.addEventListener('click', e => { if (e.target !== adv) next(); });
  closeBtn.addEventListener('click', () => close('skip'));
  card.addEventListener('pointerenter', () => { if (cur) { cur.hold = true; clearTimer(); } });
  card.addEventListener('pointerleave', () => { if (cur) { cur.hold = card.contains(document.activeElement); schedule(); } });
  card.addEventListener('focusin', () => { if (cur) { cur.hold = true; clearTimer(); } });
  card.addEventListener('focusout', () => { setTimeout(() => { if (cur && !card.contains(document.activeElement) && !card.matches(':hover')) { cur.hold = false; schedule(); } }, 0); });
  document.addEventListener('visibilitychange', () => { if (cur && !document.hidden) schedule(); });
  window.addEventListener('resize', syncHeight);

  /** item: { npc, name, title, pages:[{t,x,k}], x, pri, block, label, build(ctx)→Node|Node[] } → Promise<reason> */
  function present(item) {
    if (cur) close('preempt');
    return new Promise(resolve => {
      cur = { item, idx: 0, typing: null, resolve, timer: 0, hold: false };
      const block = !!item.block;
      root.classList.toggle('is-block', block);
      root.classList.toggle('npc-still', reducedMotion());
      root.dataset.pri = String(item.pri ?? 1);
      root.dataset.npc = item.npc;
      card.setAttribute('role', block ? 'alertdialog' : 'region');
      if (block) { card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', item.label || item.name); }
      else { card.removeAttribute('aria-modal'); card.setAttribute('aria-label', 'NPC 對話：' + item.name); }
      nameEl.textContent = item.name;
      roleEl.textContent = item.title || '';
      closeBtn.hidden = block;
      extra.replaceChildren();
      if (item.build) {
        const kids = item.build({ close: r => close(r || 'choice') });
        for (const k of [kids].flat()) if (k) extra.append(k);
      }
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('is-in');
      document.addEventListener('keydown', onKey, true);
      if (block) {
        prevFocus = document.activeElement;
        showPage(0);
        const first = card.querySelector('.npc-extra button:not([disabled])') || adv;
        try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      } else showPage(0);
    });
  }

  return {
    present,
    dismiss: reason => close(reason || 'dismiss'),
    isOpen: () => !!cur,
    isBlocking: () => !!cur && isBlock(),
    root
  };
}
