// 廠房俯視圖（Q版寫實無塵室）：機台槽位（買／升級／賣）、FOUP 沿天車軌道移動、事件視覺與環境音。寬螢幕橫向、窄螢幕（<560px）垂直排列。
// 效能：機台 SVG 依 (種類, 等級) 快取字串；槽位節點以簽章比對重用；每 tick 只切換 class 與 FOUP transform，不重建 DOM。
const enName = (eq) => (eq && eq.en && eq.en !== 'TODO' ? eq.en : '');
import { bus } from '../shared/bus.js';
import * as S from './state.js';
import * as Eco from './economy.js';
import * as Ev from './events.js';
import * as Clock from './clock.js';
import { fabStatsNow, fabMods, failedSlot } from './sim.js';
import { getEquipment, getProcess } from '../shared/content.js';
import { openUnlockSheet } from './unlock-view.js';
import { mountMarket } from './market-view.js';
import { mountOps } from './ops-view.js';
import { operatingAdvice } from './advisor.js';
import { el, fill, openDialog, toast, money, pct, fmt } from './ui.js';
import { machineSVG, dockSVG, ghostSVG } from '../fab-art/machines.js';
import * as Audio from '../audio.js';

const CELL_H_MAX = 96, CELL_H_MIN = 62; // 橫向每格寬（依容器寬度在此範圍內縮放）
const CELL_V = 56; // 縱向每槽高（§11：每槽一列 56 px）

export function mountFactoryView(root) {
  const bal = S.getBal();
  let cur = 'f1';
  let vertical = false;
  let cellH = 88;
  const slotBtns = [];            // 目前畫面上各槽位按鈕（每 tick 切換忙碌 class 用）
  const cellCache = new Map();    // 'fab:slot' → { sig, node }
  let exitNode = null, exitSig = '', hotDock = null;
  const lotEls = new Map(); // lotId → element
  let lastShip = null;

  const tabs = el('div', { class: 'ty-tabs', role: 'tablist', 'aria-label': '選擇晶圓廠' });
  const head = el('div', { class: 'ty-fabhead' });
  const cells = el('div', { class: 'ty-cells' });
  const lots = el('div', { class: 'ty-lots', 'aria-hidden': 'true' });
  // 事件特效層：微粒灰塵、停電黑幕、緊急照明
  const dust = el('div', { class: 'fa-dustwrap', 'aria-hidden': 'true' }, Array.from({ length: 16 }, (_, i) => {
    const d = el('i', { class: 'fa-dust' });
    const r = k => ((i * 37 + k * 53) % 97) / 97;
    d.style.cssText = `--x:${(r(1) * 100).toFixed(1)}%;--y:${(r(2) * 100).toFixed(1)}%;--s:${(3 + r(3) * 3).toFixed(1)}px;--t:${(5 + r(4) * 5).toFixed(1)}s;--dl:${(-r(5) * 8).toFixed(1)}s;--dx:${((r(6) - .3) * 90).toFixed(0)}px;--dy:${((r(7) - .5) * 60).toFixed(0)}px`;
    return d;
  }));
  const modeTag = el('div', { class: 'fa-modetag', 'aria-hidden': 'true' });
  const fx = [dust, el('div', { class: 'fa-darkwrap', 'aria-hidden': 'true' }), modeTag, ...[0, 1, 2].map(() => el('span', { class: 'fa-emerg', 'aria-hidden': 'true' }))];
  const line = el('div', { class: 'ty-line' }, cells, lots, ...fx);
  const actions = el('div', { class: 'ty-actions' });
  const advice = el('section', { class: 'ty-advice', 'aria-label': '值班建議' });
  const adviceTitle = el('b');
  const adviceText = el('p', { class: 'ty-muted' });
  const adviceGoal = el('p', { class: 'ty-muted' });
  const adviceBtn = el('button', { class: 'ty-btn ty-btn--primary', type: 'button' });
  advice.append(adviceTitle, adviceText, adviceGoal, adviceBtn);
  let currentAdvice;
  adviceBtn.onclick = () => {
    const a = currentAdvice;
    if (!a) return;
    if (a.action === 'slot') openSlotSheet(a.slot);
    else if (a.action === 'unlock' && a.goal) openUnlockSheet(a.goal.id);
    else if (a.action === 'sell') {
      const r = S.sellInventory(cur, Math.min(a.sellQty, S.sellRoom(cur)));
      toast(r.ok ? `賣出 ${r.n} 片，入帳 ${money(r.revenue)}` : r.reason);
    } else {
      const target = a.action === 'ops' ? opsHost : a.action === 'event' ? actions : wrap.querySelector('.ty-market');
      target?.scrollIntoView({ block: 'start', behavior: 'auto' });
      target?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    }
  };
  // 環境音音量（與 SFX 分開；元素固定不重建，拖曳時不會被打斷）
  const ambSlider = el('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(Audio.ambience.getVolume() * 100)), 'aria-label': '環境音音量（無塵室風扇與機台聲）' });
  ambSlider.addEventListener('input', () => Audio.ambience.setVolume(ambSlider.value / 100));
  const ambBox = el('div', { class: 'fa-amb' }, el('span', { text: '環境音' }), ambSlider);
  const opsHost = el('div', { class: 'ty-ops-host' });
  const wrap = el('section', { class: 'ty-fab', 'aria-label': '晶圓廠產線' }, tabs, advice, head, line, actions, opsHost, ambBox);
  root.append(wrap);
  mountOps(opsHost, () => cur);
  const market = mountMarket(wrap, () => cur);

  // ---------- 版面模式 ----------
  function computeMode() {
    const n = S.getState().fabs[cur].slots.length + 1, w = root.clientWidth;
    vertical = w < 560 || (w - 18) / n < CELL_H_MIN;
    cellH = vertical ? CELL_V : Math.max(CELL_H_MIN, Math.min(CELL_H_MAX, Math.floor((w - 18) / n)));
    line.dataset.mode = vertical ? 'v' : 'h';
  }
  const applyMode = () => {
    const before = vertical + '|' + cellH;
    computeMode();
    if (before !== vertical + '|' + cellH) renderLine();
  };
  new ResizeObserver(applyMode).observe(root);

  // ---------- Tabs ----------
  function renderTabs() {
    const s = S.getState();
    fill(tabs, ...bal.fabOrder.map(id => {
      const open = s.fabs[id].unlocked;
      return el('button', {
        class: 'ty-tab' + (id === cur ? ' is-on' : '') + (open ? '' : ' is-locked'), role: 'tab',
        'aria-selected': String(id === cur), 'data-tut': 'tab-' + id,
        'aria-label': `${bal.fabs[id].zh} ${bal.fabs[id].node}${open ? '' : '（未開通）'}`,
        onclick: () => { if (open) { cur = id; clearLots(); renderAll(); } else openUnlockSheet(id); }
      }, el('span', { text: bal.fabs[id].zh }), el('small', { text: open ? bal.fabs[id].node : '未開通' }));
    }));
  }

  // ---------- 抬頭資訊 ----------
  function renderHead() {
    const s = S.getState(), fab = s.fabs[cur], f = bal.fabs[cur];
    const st = fabStatsNow(cur);
    const missing = fab.slots.filter(x => !x).length;
    const ev = fab.event;
    let evText = null;
    if (ev) {
      const def = Ev.getEventDefs()[ev.id];
      evText = `事件：${def.name}（剩 ${ev.daysLeft} 日）`;
      if (ev.id === 'rush_order') evText += ev.extra.accepted ? (ev.extra.pending ? '，待出貨' : '，已出貨') : '，未接單';
    }
    const mode = Eco.modeOf(fab);
    const Y = st.Y;
    const profitable = Y >= st.breakEven;
    const proj = Eco.lineProjection(bal, cur, fab, S.starRatio(cur), fabMods(cur), s.res.rep, s.res.priceWalk, s.res.demandIdx);
    currentAdvice = operatingAdvice(bal, s, cur, st, proj);
    const a = currentAdvice;
    adviceTitle.textContent = `值班建議 · ${a.title}`;
    adviceText.textContent = a.text;
    adviceGoal.textContent = a.goal ? `下一座 ${bal.fabs[a.goal.id].zh}：解謎 ${a.goal.unlock.puzzle.have}/${a.goal.unlock.puzzle.need} · 聲望 ${s.res.rep.toFixed(0)}/${a.goal.unlock.rep.need} · 建議預算 ${money(a.goal.budget.total)}（尚差 ${money(Math.max(0, a.goal.budget.total - s.res.money))}）` : '五座廠已開通；持續改善良率、履約與現金周轉。';
    adviceBtn.textContent = { slot: '安裝缺少的機台', unlock: '查看下一座廠', sell: `賣多餘成品（${a.sellQty} 片）`, ops: '查看營運控制', event: '處理事件', market: '查看市場與訂單' }[a.action];
    const age = s.res.invAge[cur] || 0;
    fill(head, 
      el('div', { class: 'ty-headline' },
        el('h2', { text: `${f.zh}　${f.node}　${f.wafer}` }),
        mode !== 'run' && el('span', { class: 'ty-badge ty-badge--mode ty-badge--' + mode, 'data-tut': 'mode-badge', text: `${bal.mode.labels[mode]}（維運 ×${bal.mode.upkeep[mode]}）` }),
        fab.ramp > 0 && el('span', { class: 'ty-badge ty-badge--warn', text: `暖機中 ${fab.ramp} 小時` }),
        evText && el('span', { class: 'ty-badge ty-badge--warn', text: evText })),
      el('div', { class: 'ty-kpis' },
        kpi('線良率 Y', st.complete ? pct(Y) : '—', st.complete ? (profitable ? 'good' : 'bad') : '', st.complete ? `Y = Π(1−dᵢ)×E，盈虧平衡 ${pct(st.breakEven, 0)}` : '機台未齊，尚無完整產線良率'),
        kpi('產能', st.interval ? `${Math.round(st.wafersPerDay)} 片/日` : '—', '', st.interval ? `每 ${st.interval.toFixed(1)} 小時投 1 Lot` : '產線不通'),
        kpi('今日單價', money(st.price), '', `行情 ×${s.res.priceWalk.toFixed(2)}　成本 ${money(f.cost)}/片`),
        kpi('庫存', `${s.res.inv[cur]} 片`, age >= 3 ? 'bad' : '', `庫齡 ${age.toFixed(1)} 日　賣出才入帳`),
        kpi('預估日利潤', st.complete && mode === 'run' ? `${proj.profitPerDay >= 0 ? '+' : '−'}${money(Math.abs(proj.profitPerDay))}` : '—', proj.profitPerDay >= 0 && mode === 'run' ? 'good' : 'bad', mode === 'run' ? `目前行情；估算不含庫齡、倉儲、利息與訂單；維運 ${money(f.maintenance)}/日` : `${bal.mode.labels[mode]}中；維運 ${money(Eco.fabUpkeep(bal, cur, mode))}/日`),
        kpi('解謎星數 S', pct(S.starRatio(cur), 0), '', '缺陷率 ×(1−0.5S)')),
      s.res.inv[cur] >= bal.startHaltInv && el('p', { class: 'ty-warn', role: 'status', text: `庫存已達 ${bal.startHaltInv} 片，產線暫停投片。賣出庫存後才會繼續生產。` }),
      mode === 'run' && st.complete && s.res.money < Eco.lotCost(bal, cur) && s.res.inv[cur] > 0
        ? el('p', { class: 'ty-warn ty-warn--big', role: 'alert', text: `資金不足，產線停擺！庫存有 ${s.res.inv[cur]} 片 — 到「市場與訂單」按「全部賣出」，或用下方「營運控制」的緊急出清／貸款換現金。` })
        : mode === 'run' && st.complete && s.res.money < Eco.lotCost(bal, cur) && el('p', { class: 'ty-warn ty-warn--big', role: 'alert', text: `資金不足（需 ${money(Eco.lotCost(bal, cur))} 才能投 1 Lot），目前也沒有庫存可賣。在製品出貨後再賣，或到下方「營運控制」申請貸款。` }),
      mode === 'drain' && el('p', { class: 'ty-bn', role: 'status', text: fab.lots.length ? `只做完在製品：不再投新 Lot，還有 ${fab.lots.length} 個在製 Lot 會做完。要繼續生產，到「營運控制」切回運轉。` : '在製品已清空，這座廠不會再投片。可以切回運轉，或停機封存省維運費。' }),
      (mode === 'pause' || mode === 'mothball') && el('p', { class: 'ty-bn', role: 'status', text: mode === 'pause' ? `暫停中：${fab.lots.length} 個在製 Lot 凍在原地，維運費 ×${bal.mode.upkeep.pause}。到「營運控制」恢復運轉（免費）。` : `停機封存中：維運費 ×${bal.mode.upkeep.mothball}。要重新啟動需付 ${money(Eco.restartCost(bal, cur))}，暖機約 1 日。` }),
      mode === 'run' && bottleneckNote(proj, st),
      missing > 0 && el('p', { class: 'ty-warn', role: 'status', text: `缺機台：還有 ${missing} 個空槽，產線不通。點選空槽購買機台。` }),
      lastShip && lastShip.fabId === cur && el('p', { class: 'ty-muted', text: `最近出貨：${lastShip.good} / ${bal.lotSize} 片良品${lastShip.rush ? '（急件 2.5 倍價）' : ''}` }));
  }
  function bottleneckNote(proj, st) {
    if (!st.complete || proj.bottleneck < 0) return null;
    const b = proj.bottleneck, cat = bal.categories[bal.fabs[cur].slots[b]];
    const weak = weakestSlot();
    const msg = proj.saturated
      ? `產能（良品約 ${Math.round(proj.goodPerDay)} 片/日）已超過市場需求（約 ${proj.demand} 片/日）：再加快瓶頸不會多賣，改升良率或降低轉速更划算。`
      : proj.bottlenecks.length > 1
        ? `並列瓶頸：${proj.bottlenecks.map(k => `槽 ${k + 1}「${bal.categories[bal.fabs[cur].slots[k]]}」`).join('、')}同為最慢（${st.hours[b].toFixed(1)} 小時/Lot）。只升其中一槽產能不會變，要一起升才會加快。`
        : `瓶頸：槽 ${b + 1}「${cat}」（${st.hours[b].toFixed(1)} 小時/Lot）決定整條線的速度，升級它會提高產能（之後由下一個最慢的槽接手）。`;
    return el('p', { class: 'ty-bn', role: 'status' }, el('b', { text: '瓶頸提示　' }), msg, weak >= 0 && weak !== b ? `　良率最低的是槽 ${weak + 1}「${bal.categories[bal.fabs[cur].slots[weak]]}」。` : '');
  }
  function weakestSlot() {
    const fab = S.getState().fabs[cur], Sr = S.starRatio(cur), mods = fabMods(cur);
    let w = -1, wy = 2;
    fab.slots.forEach((sl, i) => { if (!sl) return; const y = Eco.slotYield(bal, cur, sl.equip, sl.level, Sr, mods.eventDef); if (y < wy - 1e-9) { wy = y; w = i; } });
    return w;
  }
  const kpi = (k, v, cls, sub) => el('div', { class: 'ty-kpi' + (cls ? ' ty-kpi--' + cls : '') },
    el('div', { class: 'ty-kpi-k', text: k }), el('div', { class: 'ty-kpi-v', text: v }), sub && el('div', { class: 'ty-kpi-s', text: sub }));

  // ---------- 產線 ----------
  function renderLine() {
    computeMode();
    const s = S.getState(), fab = s.fabs[cur];
    const mods = fabMods(cur);
    const Sr = S.starRatio(cur);
    const bad = failedSlot(fab);
    const cell = vertical ? CELL_V : cellH;
    line.style.setProperty('--cell', cell + 'px');
    const stNow = fabStatsNow(cur);
    const bnSet = stNow.complete ? stNow.bottlenecks : [];
    const weak = stNow.complete ? weakestSlot() : -1;
    for (const k of [...cellCache.keys()]) if (!k.startsWith(cur + ':')) cellCache.delete(k);
    const out = [];
    slotBtns.length = 0;
    fab.slots.forEach((slot, i) => {
      const kind = bal.fabs[cur].slots[i];
      const cat = bal.categories[kind];
      let name = '', sub = '', art;
      if (!slot) { art = ghostSVG(); }
      else {
        const eq = getEquipment(slot.equip);
        const d = Eco.slotDefect(bal, cur, slot.equip, slot.level, Sr, mods.eventDef);
        const y = 1 - Math.min(d, bal.yield.dMax);
        const p = Eco.slotHours(bal, slot.equip, slot.level) * mods.pMul;
        name = `${eq ? eq.zh : slot.equip} L${slot.level}`;
        sub = i === bad ? '故障停擺' : `${p.toFixed(1)} 小時 · 良率 ${pct(y, 1)}`;
        art = machineSVG(slot.equip, slot.level);
      }
      const isBn = bnSet.includes(i), isWeak = i === weak && !isBn;
      const label = slotLabel(i, slot, cat, i === bad) + (isBn ? '，瓶頸' : '');
      const litho = kind === 'lithography';
      const sig = JSON.stringify([vertical, slot ? [slot.equip, slot.level] : 0, cat, name, sub, i === bad, isBn ? bnSet.length : 0, isWeak, litho, label]);
      const key = cur + ':' + i;
      let ent = cellCache.get(key);
      if (!ent || ent.sig !== sig) {
        const body = !slot
          ? [el('div', { class: 'ty-slot-cat', text: cat }), el('div', { class: 'ty-slot-empty', text: '缺機台' }), el('div', { class: 'ty-slot-sub', text: '點選購買' })]
          : [el('div', { class: 'ty-slot-cat', text: cat }), el('div', { class: 'ty-slot-name', text: name }), el('div', { class: 'ty-slot-sub', text: sub })];
        const art$ = el('span', { class: 'fa-art', 'aria-hidden': 'true' });
        art$.innerHTML = art; // 內容為本模組產生的靜態 SVG 字串（無使用者輸入）
        const btn = el('button', { class: 'ty-slot' + (!slot ? ' is-empty' : '') + (i === bad ? ' is-bad' : '') + (isBn ? ' is-bottleneck' : ''), 'data-tut': 'slot-' + (i + 1), 'aria-label': label,
          onclick: () => openSlotSheet(i) },
          art$, el('span', { class: 'fa-txt' }, body),
          el('span', { class: 'fa-toolstate', text: slot ? '待機' : '待安裝' }),
          isBn && el('span', { class: 'ty-tag ty-tag--bn', text: bnSet.length > 1 ? '並列瓶頸' : '瓶頸' }),
          isWeak && el('span', { class: 'ty-tag ty-tag--yl', text: '良率最低' }),
          i === bad && el('span', { class: 'fa-fail', 'aria-hidden': 'true' }),
          i === bad && el('span', { class: 'fa-smoke', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')));
        const node = el('div', { class: 'ty-cellwrap' + (litho ? ' ty-cellwrap--litho' : '') },
          vertical && el('div', { class: 'ty-lane', 'aria-hidden': 'true' }), btn,
          litho && el('span', { class: 'fa-baylabel', text: '黃光區', 'aria-hidden': 'true' }));
        ent = { sig, node, btn };
        cellCache.set(key, ent);
      }
      slotBtns[i] = ent.btn;
      out.push(ent.node);
    });
    const esig = String(vertical);
    if (!exitNode || exitSig !== esig) {
      exitSig = esig;
      const art$ = el('span', { class: 'fa-art', 'aria-hidden': 'true' });
      art$.innerHTML = dockSVG();
      hotDock = el('span', { class: 'fa-hotdock', text: '急件待接單', hidden: true });
      exitNode = el('div', { class: 'ty-cellwrap ty-cellwrap--exit' },
        vertical && el('div', { class: 'ty-lane', 'aria-hidden': 'true' }),
        el('div', { class: 'ty-exit' }, art$, el('span', { class: 'fa-txt' }, el('span', { text: '出貨' }), hotDock)));
    }
    out.push(exitNode);
    fill(cells, ...out);
    cells.style.setProperty('--n', String(out.length));
    updateLots(true);
  }
  function slotLabel(i, slot, cat, bad) {
    if (!slot) return `槽位 ${i + 1}，${cat}，缺機台，點選購買`;
    const eq = getEquipment(slot.equip);
    return `槽位 ${i + 1}，${cat}，${eq ? eq.zh : slot.equip} 等級 ${slot.level}${bad ? '，故障' : ''}，點選管理`;
  }

  // ---------- 每 tick 輕量同步：忙碌燈號、事件特效、環境音 ----------
  function syncState() {
    const fab = S.getState().fabs[cur];
    const evId = fab.event?.id;
    const outage = evId === 'power_outage';
    const mode = Eco.modeOf(fab);
    const frozen = mode === 'pause' || mode === 'mothball';
    const halted = fab.halt > 0 || outage || frozen;
    const busy = new Set(fab.lots.map(l => l.slot));
    const bad = failedSlot(fab);
    slotBtns.forEach((b, i) => {
      if (!b) return;
      const lot = fab.lots.find(l => l.slot === i);
      const waiting = !!lot && lot.progress >= 1 && i < fab.slots.length - 1;
      const on = busy.has(i) && !halted && i !== bad && !waiting;
      b.classList.toggle('is-busy', on);
      b.classList.toggle('is-idle', !!fab.slots[i] && !on && i !== bad);
      b.classList.toggle('is-waiting', waiting && !halted && i !== bad);
      const stateLabel = b.querySelector('.fa-toolstate');
      if (stateLabel) stateLabel.textContent = !fab.slots[i] ? '待安裝' : i === bad ? '故障 · HOLD' : halted ? '停機 · HOLD' : waiting ? '完成 · 等下站' : on ? `加工 ${Math.min(99, Math.floor(lot.progress * 100))}%` : '待機 · READY';
    });
    line.classList.toggle('fa-outage', outage);
    line.classList.toggle('fa-halt', halted);
    for (const m of ['pause', 'mothball', 'drain']) line.classList.toggle('fa-mode-' + m, mode === m);
    modeTag.textContent = mode === 'run' ? '' : bal.mode.labels[mode];
    line.classList.toggle('fa-particle', evId === 'particle');
    if (hotDock) hotDock.hidden = !(evId === 'rush_order' && !fab.event.extra.accepted);
    // 環境音：只在產線畫面可見、時鐘運轉時發聲；每個忙碌機台一條嗡聲
    const visible = !document.hidden && !root.closest('[hidden]');
    Audio.ambience.set({ on: visible && Clock.isRunning(), busy: slotBtns.map(b => !!b && b.classList.contains('is-busy')), outage });
  }

  // ---------- FOUP 動畫 ----------
  // 在機台上停留加工（進度 < 0.6），後 40% 沿天車軌道移到下一台
  const travel = p => (p < 0.6 ? 0 : Math.min(1, (p - 0.6) / 0.4));
  function lotPos(c) {
    return vertical ? `translate(0px, ${c * CELL_V}px)` : `translate(${c * cellH}px, 0px)`;
  }
  function clearLots() { for (const e of lotEls.values()) e.remove(); lotEls.clear(); }
  const newFoup = (lot) => el('div', { class: 'ty-lot', title: `Lot #${lot.id}` },
    el('span', { class: 'fa-cab' }), el('span', { class: 'fa-foup', text: String(lot.id % 100) }), el('span', { class: 'fa-hot', text: 'HOT' }));
  function updateLots(snap) {
    const s = S.getState(), fab = s.fabs[cur];
    const ms = Clock.tickMs();
    root.style.setProperty('--ty-tick', ms + 'ms');
    root.classList.toggle('ty-still', !!s.settings.reduceMotion);
    root.classList.toggle('ty-paused', !Clock.isRunning());
    const alive = new Set();
    const ev = fab.event;
    const hotWanted = ev?.id === 'rush_order' && ev.extra.accepted && ev.extra.pending;
    let lead = null;
    for (const lot of fab.lots) {
      alive.add(lot.id);
      if (hotWanted && (!lead || lot.slot + lot.progress > lead.slot + lead.progress)) lead = lot;
      const tr = travel(lot.progress);
      const c = lot.slot + 0.5 + tr;
      let e = lotEls.get(lot.id);
      if (!e) {
        e = newFoup(lot);
        e.style.transform = lotPos(c);
        lots.append(e); lotEls.set(lot.id, e);
        void e.offsetWidth;
        e.classList.add('is-live');
      } else {
        if (snap) e.classList.remove('is-live');
        e.style.transform = lotPos(c);
        if (snap) { void e.offsetWidth; e.classList.add('is-live'); }
      }
      const moving = tr > 0;
      if (!snap && moving && e.dataset.mv !== '1' && !s.settings.reduceMotion) Audio.ambience.whoosh(); // 天車開始移動
      e.dataset.mv = moving ? '1' : '0';
      e.classList.toggle('is-down', !moving);
    }
    for (const [id, e] of lotEls) e.classList.toggle('is-hot', !!lead && lead.id === id);
    for (const [id, e] of [...lotEls]) {
      if (alive.has(id) || e.classList.contains('ty-lot--out')) continue;
      e.classList.add('ty-lot--scrap'); lotEls.delete(id);
      setTimeout(() => e.remove(), 500);
    }
    syncState();
  }
  bus.on('lot:shipped', ({ fabId, lotId, good, rush }) => {
    lastShip = { fabId, good, rush };
    Audio.sfx.ship();
    if (fabId !== cur) return;
    const e = lotEls.get(lotId);
    if (!e) return;
    e.classList.add('ty-lot--out');
    e.style.transform = lotPos(fabCells() + 0.5);
    lotEls.delete(lotId);
    setTimeout(() => e.remove(), Clock.tickMs() + 150);
  });
  const fabCells = () => S.getState().fabs[cur].slots.length;

  // ---------- 動作區 ----------
  function renderActions() {
    const s = S.getState(), fab = s.fabs[cur];
    const bits = [];
    bits.push(el('button', { class: 'ty-btn', onclick: () => openUnlockSheet(cur), text: '製程挑戰 / 解鎖資訊', 'data-tut': 'btn-puzzle' }));
    if (!fab.ups) {
      const c = S.upsCost(cur);
      bits.push(el('button', { class: 'ty-btn', disabled: s.res.money < c, text: `UPS 升級 ${money(c)}`, 'aria-label': `購買不斷電系統 ${money(c)}，停電時只損失 1 個 Lot`,
        onclick: () => { const r = S.buyUps(cur); toast(r.ok ? '已安裝 UPS' : r.reason); } }));
    } else bits.push(el('span', { class: 'ty-badge', text: 'UPS 已安裝' }));
    if (fab.event?.id === 'particle') {
      const c = Ev.cleanCost(bal, cur);
      bits.push(el('button', { class: 'ty-btn', disabled: s.res.money < c, text: `停線清洗 ${money(c)}`, 'data-tut': 'btn-clean',
        onclick: () => { const r = Ev.chooseOption(S.getState(), bal, cur, 'clean', S.spend); if (!r.ok) toast(r.reason); S.commit(); } }));
    }
    if (fab.event?.id === 'rush_order' && !fab.event.extra.accepted) {
      bits.push(el('button', { class: 'ty-btn', text: '接下急件', onclick: () => { Ev.chooseOption(S.getState(), bal, cur, 'accept', S.spend); S.commit(); } }));
    }
    if (fab.event?.id === 'tool_failure') {
      const c = Ev.repairCost(bal, cur, fab);
      bits.push(el('button', { class: 'ty-btn', disabled: s.res.money < c, text: `立刻修復 ${money(c)}`,
        onclick: () => { const r = Ev.chooseOption(S.getState(), bal, cur, 'repair', S.spend); if (!r.ok) toast(r.reason); S.commit(); } }));
    }
    fill(actions, ...bits);
  }

  // ---------- 升級前後對照 ----------
  function upgradeTable(i) {
    const s = S.getState(), fab = s.fabs[cur], slot = fab.slots[i], Sr = S.starRatio(cur), mods = fabMods(cur);
    const alt = { ...fab, slots: fab.slots.map((x, k) => (k === i ? { ...x, level: x.level + 1 } : x)) };
    const a = Eco.lineProjection(bal, cur, fab, Sr, mods, s.res.rep, 1, 1);
    const b = Eco.lineProjection(bal, cur, alt, Sr, mods, s.res.rep, 1, 1);
    const ya = Eco.slotYield(bal, cur, slot.equip, slot.level, Sr, mods.eventDef), yb = Eco.slotYield(bal, cur, slot.equip, slot.level + 1, Sr, mods.eventDef);
    const ha = Eco.slotHours(bal, slot.equip, slot.level) * mods.pMul, hb = Eco.slotHours(bal, slot.equip, slot.level + 1) * mods.pMul;
    const sg = (d, fmtFn, goodUp = true) => {
      if (Math.abs(d) < 1e-9) return el('span', { class: 'ty-muted', text: '±0' });
      return el('span', { class: (d > 0) === goodUp ? 'ty-ok' : 'ty-no', text: (d > 0 ? '+' : '−') + fmtFn(Math.abs(d)) });
    };
    const row = (k, from, to, delta) => el('tr', {}, el('th', { scope: 'row', text: k }), el('td', { text: from }), el('td', { text: '→' }), el('td', {}, el('b', { text: to })), el('td', {}, delta));
    const dProfit = b.profitPerDay - a.profitPerDay;
    const isBn = a.bottlenecks.includes(i), tied = isBn && a.bottlenecks.length > 1;
    const dW = b.wafersPerDay - a.wafersPerDay;
    // 並列瓶頸：同時升級所有並列槽，才看得到產能變化
    let pair = null;
    if (tied) {
      const alt2 = { ...fab, slots: fab.slots.map((x, k) => (a.bottlenecks.includes(k) ? { ...x, level: x.level + 1 } : x)) };
      const p2 = Eco.lineProjection(bal, cur, alt2, Sr, mods, s.res.rep, 1, 1);
      const c2 = a.bottlenecks.reduce((t, k) => t + (S.upgradeCostOf(cur, k) || 0), 0);
      pair = { p2, c2, d: p2.profitPerDay - a.profitPerDay };
    }
    const note = !a.complete ? '產線還沒齊，先補滿機台。'
      : a.saturated && b.sold <= a.sold + 1e-6 ? '目前良品已超過市場需求，這次升級幾乎不會增加營收。'
      : tied && dW < 1e-6 ? `槽 ${a.bottlenecks.map(k => k + 1).join('、')} 並列最慢：只升這一槽產能不變（僅提高良率）；兩槽一起升後產能 ${fmt(a.wafersPerDay)} → ${fmt(pair.p2.wafersPerDay)} 片/日${pair.d > 0 ? `，合計 ${money(pair.c2)}、約 ${Math.ceil(pair.c2 / pair.d)} 日回本` : ''}。`
      : isBn && dW > 1e-6 ? `這一槽是瓶頸：升級後產能 ${fmt(a.wafersPerDay)} → ${fmt(b.wafersPerDay)} 片/日（之後由下一個最慢的槽接手）。`
      : Math.abs(dW) < 1e-6 ? '這一槽不是瓶頸：只會提高良率，不會增加產能。' : '';
    const cost = S.upgradeCostOf(cur, i);
    return el('div', { class: 'ty-upg', 'data-tut': 'upg-table' },
      el('table', {},
        el('caption', { text: `升級 L${slot.level} → L${slot.level + 1} 前後對照（標準行情估算）` }),
        el('tbody', {},
          row('此槽處理時間', `${ha.toFixed(2)} 時`, `${hb.toFixed(2)} 時`, sg(hb - ha, v => v.toFixed(2), false)),
          row('此槽良率', pct(ya, 2), pct(yb, 2), sg(yb - ya, v => (v * 100).toFixed(2) + '%')),
          row('整線良率 Y', pct(a.Y), pct(b.Y), sg(b.Y - a.Y, v => (v * 100).toFixed(1) + '%')),
          row('產能（片/日）', fmt(a.wafersPerDay), fmt(b.wafersPerDay), sg(b.wafersPerDay - a.wafersPerDay, fmt)),
          row('預估日利潤', money(a.profitPerDay), money(b.profitPerDay), sg(dProfit, v => money(v))))),
      note && el('p', { class: 'ty-muted', text: note }),
      dProfit > 0 && cost ? el('p', { class: 'ty-muted', text: `約 ${Math.ceil(cost / dProfit)} 日回本。` }) : null);
  }

  // ---------- 槽位面板 ----------
  function openSlotSheet(i) {
    Clock.lock();
    let off;
    const dlg = openDialog({ title: `槽位 ${i + 1}：${bal.categories[bal.fabs[cur].slots[i]]}`, onClose: () => { off?.(); Clock.unlock(); } });
    const sRender = () => {
      const s = S.getState(), fab = s.fabs[cur], slot = fab.slots[i];
      const Sr = S.starRatio(cur), mods = fabMods(cur);
      const err = el('p', { class: 'ty-err', 'aria-live': 'polite' });
      const body = [];
      if (!slot) {
        body.push(el('p', { class: 'ty-muted', text: '選擇要放入的機台（價格 = 基價 × 廠倍率）：' }));
        const budget = Eco.startupBudget(bal, cur);
        body.push(el('p', { class: 'ty-budget', text: `機台補齊後建議保留 ${money(budget.working)} 週轉金，讓首批成品完成後再出售。` }));
        for (const id of Eco.allowedEquip(bal, cur, i)) {
          const b = bal.equipment[id], eq = getEquipment(id), price = Eco.equipPrice(bal, cur, id);
          const d = Eco.slotDefect(bal, cur, id, 1, Sr, mods.eventDef);
          body.push(el('button', { class: 'ty-opt', disabled: s.res.money < price, 'data-tut': 'buy-' + id,
            onclick: () => { const r = S.buyEquip(cur, i, id); if (r.ok) dlg.close(); else err.textContent = r.reason; } },
            el('div', { class: 'ty-opt-t' }, el('b', { text: eq ? eq.zh : id }), el('span', { text: money(price) })),
            el('div', { class: 'ty-opt-s', text: `${enName(eq)}　處理 ${Eco.slotHours(bal, id, 1).toFixed(1)} 小時　單槽良率 ${pct(1 - Math.min(d, 0.5))}　缺陷係數 ×${b.defMul}` }),
            eq && el('div', { class: 'ty-opt-s', text: eq.purpose })));
        }
      } else {
        const eq = getEquipment(slot.equip);
        const d = Eco.slotDefect(bal, cur, slot.equip, slot.level, Sr, mods.eventDef);
        const up = S.upgradeCostOf(cur, i);
        const refund = Eco.sellRefund(bal, slot.invested);
        body.push(
          el('p', {}, el('b', { text: `${eq ? eq.zh : slot.equip}${enName(eq) ? `（${enName(eq)}）` : ''}` }), ` 等級 ${slot.level} / ${bal.equip.maxLevel}`),
          eq && el('p', { class: 'ty-muted', text: eq.purpose }),
          el('p', { class: 'ty-muted', text: `處理時間 ${(Eco.slotHours(bal, slot.equip, slot.level) * mods.pMul).toFixed(2)} 小時　缺陷率 d = ${pct(d, 2)}　單槽良率 ${pct(1 - Math.min(d, 0.5), 2)}` }),
          up != null && upgradeTable(i),
          up != null && s.res.money - up < Eco.guardDefault(bal, cur) && el('p', { class: 'ty-warn', text: '升級後現金會低於一批投片與每日維運的建議保留額，請先賣出成品或備妥週轉金。' }),
          el('div', { class: 'ty-choices' },
            el('button', { class: 'ty-btn ty-btn--primary', disabled: up == null || s.res.money < up, 'data-tut': 'btn-upgrade',
              text: up == null ? '已達最高等級' : `升級 ${money(up)}`,
              onclick: () => { const r = S.upgradeEquip(cur, i); if (!r.ok) err.textContent = r.reason; } }),
            el('button', { class: 'ty-btn ty-btn--danger', text: `出售（退 ${money(refund)}）`,
              onclick: function () {
                if (this.dataset.armed) { S.sellEquip(cur, i); dlg.close(); }
                else { this.dataset.armed = '1'; this.textContent = `再按一次確認出售（退 ${money(refund)}）`; }
              } })));
        if (failedSlot(fab) === i) {
          const c = Ev.repairCost(bal, cur, fab);
          body.push(el('button', { class: 'ty-btn', disabled: s.res.money < c, text: `立刻修復 ${money(c)}`,
            onclick: () => { const r = Ev.chooseOption(S.getState(), bal, cur, 'repair', S.spend); if (!r.ok) err.textContent = r.reason; else S.commit(); } }));
        }
      }
      body.push(err);
      fill(dlg.body, ...body);
    };
    off = bus.on('state:changed', sRender);
    sRender();
  }

  // ---------- 總更新 ----------
  function renderAll() { renderTabs(); renderHead(); renderLine(); renderActions(); market.render(); }
  bus.on('state:changed', () => { renderTabs(); renderHead(); renderLine(); renderActions(); });
  bus.on('state:reset', () => { cur = 'f1'; clearLots(); });
  bus.on('tick', () => { updateLots(false); if (S.getState().clock.tick % 2 === 0) renderHead(); });
  bus.on('day', () => { renderHead(); renderActions(); renderLine(); });
  bus.on('event:end', () => { renderHead(); renderActions(); renderLine(); });
  bus.on('clock:changed', () => { root.classList.toggle('ty-paused', !Clock.isRunning()); syncState(); });
  bus.on('event:trigger', () => { renderLine(); renderActions(); });
  computeMode();
  renderAll();
  return { setFab(id) { cur = id; clearLots(); renderAll(); }, getFab: () => cur };
}
