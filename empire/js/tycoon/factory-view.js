// 廠房俯視圖：機台槽位（買／升級／賣）、Lot 沿產線動畫。寬螢幕橫向、窄螢幕（<560px）垂直排列。
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
import { el, fill, openDialog, toast, money, pct, fmt } from './ui.js';

const CELL_H = 88; // 橫向每格寬
const CELL_V = 56; // 縱向每槽高（§11：每槽一列 56 px）

export function mountFactoryView(root) {
  const bal = S.getBal();
  let cur = 'f1';
  let vertical = false;
  const lotEls = new Map(); // lotId → element
  let lastShip = null;

  const tabs = el('div', { class: 'ty-tabs', role: 'tablist', 'aria-label': '選擇晶圓廠' });
  const head = el('div', { class: 'ty-fabhead' });
  const cells = el('div', { class: 'ty-cells' });
  const lots = el('div', { class: 'ty-lots', 'aria-hidden': 'true' });
  const line = el('div', { class: 'ty-line' }, cells, lots);
  const actions = el('div', { class: 'ty-actions' });
  const wrap = el('section', { class: 'ty-fab', 'aria-label': '晶圓廠產線' }, tabs, head, line, actions);
  root.append(wrap);
  const market = mountMarket(wrap, () => cur);

  // ---------- 版面模式 ----------
  const applyMode = () => {
    const v = root.clientWidth < 560;
    if (v !== vertical || !line.dataset.mode) {
      vertical = v;
      line.dataset.mode = v ? 'v' : 'h';
      renderLine();
    }
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
    const Y = st.Y;
    const profitable = Y >= st.breakEven;
    const proj = Eco.lineProjection(bal, cur, fab, S.starRatio(cur), fabMods(cur), s.res.rep, 1, 1);
    const age = s.res.invAge[cur] || 0;
    fill(head, 
      el('div', { class: 'ty-headline' },
        el('h2', { text: `${f.zh}　${f.node}　${f.wafer}` }),
        evText && el('span', { class: 'ty-badge ty-badge--warn', text: evText })),
      el('div', { class: 'ty-kpis' },
        kpi('線良率 Y', pct(Y), profitable ? 'good' : 'bad', `Y = Π(1−dᵢ)×E，盈虧平衡 ${pct(st.breakEven, 0)}`),
        kpi('產能', st.interval ? `${Math.round(st.wafersPerDay)} 片/日` : '—', '', st.interval ? `每 ${st.interval.toFixed(1)} 小時投 1 Lot` : '產線不通'),
        kpi('今日單價', money(st.price), '', `行情 ×${s.res.priceWalk.toFixed(2)}　成本 ${money(f.cost)}/片`),
        kpi('庫存', `${s.res.inv[cur]} 片`, age >= 3 ? 'bad' : '', `庫齡 ${age.toFixed(1)} 日　賣出才入帳`),
        kpi('預估日利潤', st.complete ? `${proj.profitPerDay >= 0 ? '+' : '−'}${money(Math.abs(proj.profitPerDay))}` : '—', proj.profitPerDay >= 0 ? 'good' : 'bad', `標準行情；維運 ${money(f.maintenance)}/日`),
        kpi('解謎星數 S', pct(S.starRatio(cur), 0), '', '缺陷率 ×(1−0.5S)')),
      s.res.inv[cur] >= bal.startHaltInv && el('p', { class: 'ty-warn', role: 'status', text: `庫存已達 ${bal.startHaltInv} 片，產線暫停投片。賣出庫存後才會繼續生產。` }),
      st.complete && s.res.money < Eco.lotCost(bal, cur) && s.res.inv[cur] > 0
        ? el('p', { class: 'ty-warn ty-warn--big', role: 'alert', text: `資金不足，產線停擺！庫存有 ${s.res.inv[cur]} 片 — 趕快到下方「市場與訂單」按「全部賣出」換現金。` })
        : st.complete && s.res.money < Eco.lotCost(bal, cur) && el('p', { class: 'ty-warn ty-warn--big', role: 'alert', text: `資金不足（需 ${money(Eco.lotCost(bal, cur))} 才能投 1 Lot），目前也沒有庫存可賣，等在製品出貨後再賣。` }),
      bottleneckNote(proj, st),
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
    const s = S.getState(), fab = s.fabs[cur];
    const mods = fabMods(cur);
    const Sr = S.starRatio(cur);
    const bad = failedSlot(fab);
    const cell = vertical ? CELL_V : CELL_H;
    line.style.setProperty('--cell', cell + 'px');
    const busySlots = new Set(fab.lots.map(l => l.slot));
    const stNow = fabStatsNow(cur);
    const bnSet = stNow.complete ? stNow.bottlenecks : [];
    const weak = stNow.complete ? weakestSlot() : -1;
    const out = [];
    fab.slots.forEach((slot, i) => {
      const cat = bal.categories[bal.fabs[cur].slots[i]];
      let body;
      if (!slot) {
        body = [el('div', { class: 'ty-slot-cat', text: cat }), el('div', { class: 'ty-slot-empty', text: '缺機台' }), el('div', { class: 'ty-slot-sub', text: '點選購買' })];
      } else {
        const eq = getEquipment(slot.equip);
        const d = Eco.slotDefect(bal, cur, slot.equip, slot.level, Sr, mods.eventDef);
        const y = 1 - Math.min(d, bal.yield.dMax);
        const p = Eco.slotHours(bal, slot.equip, slot.level) * mods.pMul;
        body = [
          el('div', { class: 'ty-slot-cat', text: cat }),
          el('div', { class: 'ty-slot-name', text: `${eq ? eq.zh : slot.equip} L${slot.level}` }),
          el('div', { class: 'ty-slot-sub', text: i === bad ? '故障停擺' : `${p.toFixed(1)} 小時 · 良率 ${pct(y, 1)}` }),
          bnSet.includes(i) && el('span', { class: 'ty-tag ty-tag--bn', text: bnSet.length > 1 ? '並列瓶頸' : '瓶頸' }),
          i === weak && !bnSet.includes(i) && el('span', { class: 'ty-tag ty-tag--yl', text: '良率最低' })
        ];
      }
      const cls = 'ty-slot' + (!slot ? ' is-empty' : '') + (i === bad ? ' is-bad' : '') + (busySlots.has(i) ? ' is-busy' : '') + (bnSet.includes(i) ? ' is-bottleneck' : '');
      out.push(el('div', { class: 'ty-cellwrap' },
        vertical && el('div', { class: 'ty-lane', 'aria-hidden': 'true' }),
        el('button', { class: cls, 'data-tut': 'slot-' + (i + 1), 'aria-label': slotLabel(i, slot, cat, i === bad) + (bnSet.includes(i) ? '，瓶頸' : ''),
          onclick: () => openSlotSheet(i) }, body)));
    });
    out.push(el('div', { class: 'ty-cellwrap ty-cellwrap--exit' },
      vertical && el('div', { class: 'ty-lane', 'aria-hidden': 'true' }),
      el('div', { class: 'ty-exit', text: '出貨' })));
    fill(cells, ...out);
    cells.style.setProperty('--n', String(out.length));
    updateLots(true);
  }
  function slotLabel(i, slot, cat, bad) {
    if (!slot) return `槽位 ${i + 1}，${cat}，缺機台，點選購買`;
    const eq = getEquipment(slot.equip);
    return `槽位 ${i + 1}，${cat}，${eq ? eq.zh : slot.equip} 等級 ${slot.level}${bad ? '，故障' : ''}，點選管理`;
  }

  // ---------- Lot 動畫 ----------
  function lotPos(c) {
    return vertical ? `translate(0px, ${c * CELL_V}px)` : `translate(${c * CELL_H}px, 0px)`;
  }
  function clearLots() { for (const e of lotEls.values()) e.remove(); lotEls.clear(); }
  function updateLots(snap) {
    const s = S.getState(), fab = s.fabs[cur];
    const ms = Clock.tickMs();
    root.style.setProperty('--ty-tick', ms + 'ms');
    root.classList.toggle('ty-still', !!s.settings.reduceMotion);
    root.classList.toggle('ty-paused', !Clock.isRunning());
    const alive = new Set();
    for (const lot of fab.lots) {
      alive.add(lot.id);
      const c = lot.slot + 0.5 + lot.progress;
      let e = lotEls.get(lot.id);
      if (!e) {
        e = el('div', { class: 'ty-lot', title: `Lot #${lot.id}`, text: String(lot.id % 100) });
        e.style.transform = lotPos(c);
        lots.append(e); lotEls.set(lot.id, e);
        void e.offsetWidth;
        e.classList.add('is-live');
      } else {
        if (snap) e.classList.remove('is-live');
        e.style.transform = lotPos(c);
        if (snap) { void e.offsetWidth; e.classList.add('is-live'); }
      }
    }
    for (const [id, e] of [...lotEls]) {
      if (alive.has(id) || e.classList.contains('ty-lot--out')) continue;
      e.classList.add('ty-lot--scrap'); lotEls.delete(id);
      setTimeout(() => e.remove(), 500);
    }
  }
  bus.on('lot:shipped', ({ fabId, lotId, good, rush }) => {
    lastShip = { fabId, good, rush };
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
  bus.on('clock:changed', () => { root.classList.toggle('ty-paused', !Clock.isRunning()); });
  vertical = root.clientWidth < 560;
  line.dataset.mode = vertical ? 'v' : 'h';
  renderAll();
  return { setFab(id) { cur = id; clearLots(); renderAll(); }, getFab: () => cur };
}
