// 教學（DESIGN §10）：以 data-tut 鎖定元素，半透明遮罩只開一個洞讓玩家點高亮目標；可隨時跳過。
// 進度存在 save.tutorial.done（以 "tut:<phase>" 記錄），重新整理後可續玩。
import { bus } from './shared/bus.js';
import * as S from './tycoon/state.js';
import { getProcess } from './shared/content.js';
import { lineText, portraitSvg, typewrite, npcInfo } from './npc/index.js';

const $ = sel => document.querySelector(sel);
const byTut = id => $(`[data-tut="${id}"]`);
const resolve = t => (typeof t === 'function' ? t() : t ? (/^[.\[#]/.test(t) ? $(t) : byTut(t)) : null);
const chips = () => document.querySelectorAll('.pz-chip:not(.pz-chip-empty)').length;
const levelHead = () => ($('.pz-head h2')?.textContent || '').trim().toUpperCase();
const visible = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

const isDone = id => S.getState().tutorial.done.includes('tut:' + id);
function mark(id) {
  const d = S.getState().tutorial.done;
  if (!d.includes('tut:' + id)) { d.push('tut:' + id); S.save(); }
}

export function createTutorial() {
  let rootEl = null, dims = [], ring = null, card = null;
  let raf = 0, steps = [], idx = 0, cur = null, active = false, standalone = false;
  let shipCount = 0, soldCount = 0, base = 0, lastTarget = null, shownKey = '', ptKey = '', typing = null;
  const refs = {};

  bus.on('lot:shipped', () => { shipCount++; });
  bus.on('inv:sold', () => { soldCount++; });
  bus.on('state:reset', () => { if (active) stop(); });

  // ---------------- 內容 ----------------
  const slotName = k => S.getBal().categories[S.getBal().fabs.f1.slots[k]];
  const buyBtn = () => document.querySelector('.ty-dlg [data-tut^="buy-"]:not(:disabled)');

  // 台詞在 data/dialogue.json（id 以 tut. 開頭）；T() 回傳 { npc, x, text } 併入步驟。
  const T = (id, vars) => { const l = lineText(id, vars); return { npc: l.npc, x: l.x, text: l.text }; };

  function phases() {
    const bal = S.getBal();
    const lith = getProcess('lithography')?.summary || '';
    const buy = [0, 1, 2, 3].map(k => {
      const pick = T('tut.buy.pick'), slot = T('tut.buy.slot', { k: k + 1, slot: slotName(k) });
      return {
        title: `買機台 ${k + 1} / 4：${slotName(k)}`,
        npc: slot.npc, x: slot.x,
        text: () => (buyBtn() ? pick.text : slot.text),
        target: () => buyBtn() || byTut('slot-' + (k + 1)),
        done: () => !!S.getState().fabs.f1.slots[k],
      };
    });
    const lithoCard = (name, k, title, id, vars) => ({
      title, ...T(id, vars), target: () => byTut('btn-confirm') || byTut('card-' + name),
      done: () => chips() >= k + 1 && levelHead().startsWith('F1-2') || (k === 4 && !!$('.pz-result-back')),
    });
    return [
      { id: 'intro', steps: [{ title: '歡迎來到晶圓帝國', ...T('tut.intro'), dim: true, mode: 'next', nextLabel: '開始' }] },
      { id: 't-buy', skipIf: () => S.getState().fabs.f1.slots.every(Boolean), steps: buy },
      { id: 't-run', steps: [
        { title: '開始生產', ...T('tut.run.start'), target: 'clock-1x', done: () => !S.getState().clock.paused },
        { title: '看 Lot 走完', ...T('tut.run.watch'), target: 'clock-2x', block: false,
          enter: () => { base = shipCount; }, done: () => shipCount > base },
        { title: '良率怎麼算', ...T('tut.run.yield'), mode: 'next', pos: 'bottom', nextLabel: '懂了' },
        { title: '成品不會自動賣出', ...T('tut.run.nosell'), mode: 'next', pos: 'bottom', nextLabel: '懂了' },
        { title: '賣出庫存', ...T('tut.run.sell'), target: 'btn-sell-all', block: false,
          enter: () => { base = soldCount; }, done: () => soldCount > base },
        { title: '訂單與轉速', ...T('tut.run.orders'), mode: 'next', pos: 'bottom', nextLabel: '知道了' },
      ] },
      { id: 't-puzzle', steps: [
        { title: '想開 Fab 2 嗎？', ...T('tut.puzzle.intro'), mode: 'next', nextLabel: '去看看' },
        { title: '製程挑戰', ...T('tut.puzzle.btn'), target: 'btn-puzzle', done: () => !!byTut('unlock-puzzle') || !!$('.pz-root') },
        { title: '開始解謎', ...T('tut.puzzle.start'), target: 'unlock-puzzle', done: () => !!$('.pz-root') },
      ] },
      { id: 't-card', steps: [
        { title: '選第 1 關', ...T('tut.card.level1'), target: '[data-level="f1-1"]', done: () => levelHead().startsWith('F1-1') },
        { title: '打出沉積卡', ...T('tut.card.deposit'), target: 'card-deposit', done: () => !!$('.pz-sheet') || chips() > 0 },
        { title: '選參數', ...T('tut.card.param'),
          target: () => byTut('param-t-2') || byTut('card-deposit'),
          done: () => !!$('[data-tut="param-t-2"][aria-pressed="true"]') || chips() > 0 },
        { title: '確認出牌', ...T('tut.card.confirm'), target: () => byTut('btn-confirm') || byTut('card-deposit'), done: () => chips() > 0 },
      ] },
      { id: 't-star', steps: [
        { done: () => !!$('.pz-result-back') || !levelHead().startsWith('F1-1') },
        { title: '三顆星與「浪費」', ...T('tut.star.stars'), mode: 'next', pos: 'top', nextLabel: '了解' },
        { title: '下一關', ...T('tut.star.next'), target: 'btn-next', pos: 'top',
          done: () => levelHead().startsWith('F1-2') || !$('.pz-result-back') },
      ] },
      { id: 't-litho', steps: [
        lithoCard('spin', 0, '微影 1/5：旋塗光阻', 'tut.litho.1', { lith }),
        lithoCard('expose', 1, '微影 2/5：曝光', 'tut.litho.2'),
        lithoCard('develop', 2, '微影 3/5：顯影', 'tut.litho.3'),
        lithoCard('etch', 3, '微影 4/5：蝕刻', 'tut.litho.4'),
        lithoCard('strip', 4, '微影 5/5：去光阻', 'tut.litho.5'),
        { title: '教學完成', ...T('tut.done', { money: '$' + bal.fabs.f2.unlockMoney.toLocaleString('en-US'), rep: bal.fabs.f2.unlockRep }),
          mode: 'next', pos: 'top', nextLabel: '完成', done: undefined },
      ] },
    ];
  }

  // ---------------- 介面 ----------------
  function build() {
    rootEl = document.createElement('div');
    rootEl.className = 'we-tut';
    rootEl.setAttribute('role', 'dialog'); rootEl.setAttribute('aria-label', '教學');
    dims = [0, 1, 2, 3].map(() => { const d = document.createElement('div'); d.className = 'we-tut-dim'; return d; });
    ring = document.createElement('div'); ring.className = 'we-tut-ring';
    card = document.createElement('div'); card.className = 'we-tut-card';
    refs.pt = document.createElement('div'); refs.pt.className = 'npc-pt npc-pt--sm';
    refs.who = document.createElement('div'); refs.who.className = 'npc-who';
    refs.h = document.createElement('h3'); refs.p = document.createElement('p'); refs.p.className = 'npc-ttext';
    refs.p.addEventListener('click', () => { if (typing && !typing.done) typing.finish(); });
    refs.prog = document.createElement('span'); refs.prog.className = 'we-tut-prog';
    refs.next = document.createElement('button'); refs.next.className = 'we-btn we-btn--primary'; refs.next.type = 'button';
    refs.skip = document.createElement('button'); refs.skip.className = 'we-btn'; refs.skip.type = 'button'; refs.skip.textContent = '跳過教學';
    refs.next.addEventListener('click', () => { if (cur && cur.mode === 'next') advance(); });
    refs.skip.addEventListener('click', () => skip());
    const row = document.createElement('div'); row.className = 'we-tut-row';
    row.append(refs.prog, refs.skip, refs.next);
    const body = document.createElement('div'); body.className = 'npc-tbody';
    body.append(refs.who, refs.h, refs.p);
    const top = document.createElement('div'); top.className = 'npc-tcard';
    top.append(refs.pt, body);
    card.append(top, row);
    rootEl.append(...dims, ring, card);
    document.body.append(rootEl);
  }

  function setRect(d, l, t, w, h) { d.style.cssText = `left:${l}px;top:${t}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px;display:block`; }

  function render(t) {
    const st = cur;
    const W = window.innerWidth, H = window.innerHeight;
    const block = st.block !== false;
    dims.forEach(d => { d.style.display = 'none'; });
    ring.style.display = 'none';
    if (st.dim) setRect(dims[0], 0, 0, W, H);
    else if (t && visible(t)) {
      const r = t.getBoundingClientRect(), pad = 5;
      const x0 = Math.max(0, r.left - pad), y0 = Math.max(0, r.top - pad), x1 = Math.min(W, r.right + pad), y1 = Math.min(H, r.bottom + pad);
      if (block) {
        setRect(dims[0], 0, 0, W, y0);
        setRect(dims[1], 0, y1, W, H - y1);
        setRect(dims[2], 0, y0, x0, y1 - y0);
        setRect(dims[3], x1, y0, W - x1, y1 - y0);
      }
      ring.style.cssText = `display:block;left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`;
    }
    // 卡片
    const text = typeof st.text === 'function' ? st.text() : st.text;
    card.style.display = text || st.title ? '' : 'none';
    const key = `${st.title}|${text}|${st.npc}|${st.x}`;
    if (key !== shownKey) {
      shownKey = key;
      refs.h.textContent = st.title || '';
      refs.h.style.display = st.title ? '' : 'none';
      const npc = st.npc || 'facility', info = npcInfo(npc);
      refs.who.textContent = '';
      const b = document.createElement('b'); b.textContent = info.name;
      refs.who.append(b, ' ' + (info.title || ''));
      const pk = npc + '|' + (st.x || 'normal');
      if (pk !== ptKey) { ptKey = pk; refs.pt.innerHTML = portraitSvg(npc, st.x || 'normal'); }
      typing?.cancel();
      typing = typewrite(refs.p, text || '');
    }
    refs.next.style.display = st.mode === 'next' ? '' : 'none';
    refs.next.textContent = st.nextLabel || '下一步';
    refs.prog.textContent = `${idx + 1} / ${steps.length}`;
    let atTop = st.pos === 'top';
    if (!st.pos) {
      if (t && visible(t)) { const r = t.getBoundingClientRect(); atTop = (r.top + r.bottom) / 2 > H * 0.5; }
    }
    card.classList.toggle('at-top', atTop);
    card.classList.toggle('at-bottom', !atTop);
    if (t && t !== lastTarget && visible(t)) {
      lastTarget = t;
      const r = t.getBoundingClientRect();
      if (r.top < 0 || r.bottom > H) { try { t.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* ignore */ } }
    }
  }

  function enter() {
    cur = steps[idx];
    shownKey = ''; lastTarget = null;
    if (refs.next) refs.next.style.display = cur && cur.mode === 'next' ? '' : 'none';
    cur?.enter?.();
  }
  function advance() {
    const prev = cur;
    if (prev && prev._last && !standalone) mark(prev._phase);
    idx += 1;
    if (idx >= steps.length) { finish(); return; }
    enter();
  }
  function frame() {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    if (!cur) return;
    if (cur.done && cur.done()) { advance(); return; }
    render(cur.target ? resolve(cur.target) : null);
  }

  function run(list, solo = false) {
    steps = [];
    for (const ph of list) {
      ph.steps.forEach((s, i) => steps.push({ ...s, _phase: ph.id, _last: i === ph.steps.length - 1 }));
    }
    if (!steps.length) return false;
    stop();
    idx = 0; active = true; standalone = solo;
    build(); enter();
    raf = requestAnimationFrame(frame);
    return true;
  }
  function stop() {
    active = false; cancelAnimationFrame(raf);
    typing?.cancel(); typing = null; ptKey = '';
    rootEl?.remove(); rootEl = null; cur = null;
  }
  function finish() { if (!standalone) mark('finished'); stop(); bus.emit('tutorial:end', {}); }
  function skip() { if (!standalone) { mark('skipped'); mark('finished'); } stop(); bus.emit('tutorial:end', { skipped: true }); }

  // ---------------- 對外 ----------------
  function start({ fresh = false } = {}) {
    if (fresh) {
      const d = S.getState().tutorial.done;
      S.getState().tutorial.done = d.filter(x => !x.startsWith('tut:'));
    }
    const todo = phases().filter(p => !isDone(p.id) && !(p.skipIf && p.skipIf()));
    return run(todo);
  }
  /** 續玩：沒完成也沒跳過才自動接續 */
  const needsResume = () => !isDone('finished') && !isDone('skipped');

  /** 首個事件的引導（事件彈窗已由 HUD 開啟）；教學進行中或已跳過則不介入 */
  bus.on('event:trigger', () => {
    if (active || isDone('skipped') || isDone('event')) return;
    if (!document.querySelector('.ty-dlg--modal, .npc-root.is-block')) return;
    mark('event');
    run([{ id: 'event-guide-run', steps: [{
      title: '事件發生了！', pos: 'top', ...T('tut.event'),
      target: () => byTut('event-clean') || document.querySelector('.ty-dlg--modal [data-tut^="event-"], .npc-root.is-block [data-tut^="event-"]'),
      done: () => !document.querySelector('.ty-dlg--modal, .npc-root.is-block'),
    }] }], true);
  });

  return { start, skip, needsResume, isActive: () => active, isDone };
}
