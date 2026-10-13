// 營運控制面板（產線頁）：產線狀態（運轉／只做完在製品／暫停／停機封存）、資金週轉（貸款、緊急出清）、自動化設定。
// 重繪策略：各區塊先組出新節點，HTML 與上次相同就保留舊節點（避免每個 tick 重建造成按鈕「按不到」）；自動化區的滑桿每廠只建一次。
import { bus } from '../shared/bus.js';
import * as S from './state.js';
import * as Eco from './economy.js';
import { el, fill, toast, money, fmt } from './ui.js';
import { showRescue } from './rescue.js';

export const MODE_ORDER = ['run', 'drain', 'pause', 'mothball'];
export const modeLabel = (bal, m) => bal.mode.labels[m] || m;

export function mountOps(root, getCur) {
  const bal = S.getBal();
  const box = el('section', { class: 'ty-ops', 'aria-label': '營運控制' });
  const modeBox = el('div', { class: 'ty-ops-mode' });
  const cashBox = el('div', { class: 'ty-ops-cash' });
  const autoHost = el('div', { class: 'ty-ops-auto' });
  box.append(el('h3', { class: 'ty-sec', text: '營運控制' }), modeBox, cashBox, autoHost);
  root.append(box);

  // 兩段式確認（重繪不會洗掉）：key → 到期時間
  let armedKey = null, armedTimer = 0;
  const isArmed = k => armedKey === k;
  const arm = k => { armedKey = k; clearTimeout(armedTimer); armedTimer = setTimeout(() => { armedKey = null; render(); }, 6000); render(); };
  const disarm = () => { armedKey = null; clearTimeout(armedTimer); };

  function swap(host, nodes) {
    const tmp = el('div', {}, ...nodes.filter(Boolean));
    const html = tmp.innerHTML;
    if (host._html === html) return;
    host._html = html;
    const act = document.activeElement;
    const fk = act && host.contains(act) ? act.dataset.fk : null;
    fill(host, ...tmp.childNodes);
    if (fk) host.querySelector(`[data-fk="${fk}"]`)?.focus({ preventScroll: true });
  }

  // ---------- 產線狀態 ----------
  const MODE_DESC = {
    run: '正常投片，Lot 自動排隊進產線。',
    drain: '不再投新 Lot，在製品照常做完、出貨進庫存。維運費照付；現金吃緊時先止血用。',
    pause: '在製品凍在原地，不投片也不出貨。維運費降為 ×{pause}；隨時可恢復，免費。',
    mothball: '在製品要先清空（否則報廢）。維運費只剩 ×{mothball}；重新啟動要付重啟費並暖機約 1 日。'
  };
  function renderMode() {
    const s = S.getState(), cur = getCur(), fab = s.fabs[cur], f = bal.fabs[cur];
    if (!fab?.unlocked) { swap(modeBox, []); return; }
    const mode = Eco.modeOf(fab), n = fab.lots.length;
    const btn = m => {
      const up = Eco.fabUpkeep(bal, cur, m);
      const on = m === mode;
      let sub = `維運 ×${bal.mode.upkeep[m]} · ${money(up)}/日`, disabled = on;
      let label = bal.mode.labels[m];
      let onclick = () => { disarm(); const r = S.setMode(cur, m); if (!r.ok) toast(r.reason); };
      if (mode === 'mothball' && m !== 'mothball') {
        if (m === 'run') {
          const c = Eco.restartCost(bal, cur);
          label = '重新啟動'; sub = `重啟費 ${money(c)} · 暖機約 1 日`; disabled = s.res.money < c;
        } else { disabled = true; sub = '先重新啟動'; }
      } else if (m === 'mothball' && !on) {
        if (n > 0) {
          const k = 'mb:' + cur;
          if (isArmed(k)) { label = `確認封存（報廢 ${n} Lot）`; onclick = () => { disarm(); const r = S.setMode(cur, 'mothball', { confirmScrap: true }); if (!r.ok) toast(r.reason); }; }
          else { onclick = () => arm(k); sub += ` · 會報廢 ${n} 個在製 Lot`; }
        }
      }
      return el('button', { class: 'ty-btn ty-mode ty-mode--' + m + (on ? ' is-on' : ''), type: 'button', 'aria-pressed': String(on), disabled,
        'data-fk': 'mode-' + m, 'data-tut': 'mode-' + m, onclick },
      el('b', { text: label }), el('div', { class: 'ty-opt-s', text: sub }));
    };
    const stat = [`在製 ${n} Lot`, `維運 ${money(Eco.fabUpkeep(bal, cur, mode))}/日`];
    if (fab.ramp > 0) stat.push(`暖機中，剩 ${fab.ramp} 小時`);
    if (mode === 'drain') stat.push(n ? '正在做完在製品…' : '在製品已清空（可封存或切回運轉）');
    swap(modeBox, [
      el('h4', { class: 'ty-sub', text: `${f.zh} 產線狀態：${bal.mode.labels[mode]}` }),
      el('p', { class: 'ty-muted', text: MODE_DESC[mode].replace('{pause}', bal.mode.upkeep.pause).replace('{mothball}', bal.mode.upkeep.mothball) }),
      el('p', { class: 'ty-muted', role: 'status', text: stat.join('　·　') }),
      el('div', { class: 'ty-choices ty-modes', role: 'group', 'aria-label': `${f.zh} 產線狀態` }, MODE_ORDER.map(btn))
    ]);
  }

  // ---------- 資金週轉 ----------
  function renderCash() {
    const s = S.getState(), r = s.res, cur = getCur(), fab = s.fabs[cur];
    if (!fab?.unlocked) { swap(cashBox, []); return; }
    const owed = S.loanOwed(), avail = S.loanAvailable(), limit = S.creditLimit(), day = S.currentDay();
    const L = bal.loan;
    const dead = S.deadEndInfo();
    const kids = [el('h4', { class: 'ty-sub', text: '資金週轉' })];
    if (dead.stuck) {
      kids.push(el('div', { class: 'ty-warn ty-warn--big', role: 'alert' },
        `資金斷鏈：沒有在製品、沒有庫存，現金 ${money(r.money)} 又不夠做下一步（要 ${money(dead.need)}）。`,
        el('div', { class: 'ty-choices' }, el('button', { class: 'ty-btn ty-btn--primary', type: 'button', 'data-fk': 'rescue', onclick: () => showRescue(), text: '請林姐幫忙想辦法' }))));
    }
    kids.push(el('div', { class: 'ty-kpis ty-cashkpis' },
      kpi('現金', money(r.money), ''), kpi('授信額度', money(limit), '', `聲望 ${r.rep.toFixed(0)}、最高 ${bal.fabs[bal.fabOrder.filter(f => s.fabs[f].unlocked).pop()].zh}`),
      kpi('貸款欠款', money(owed), owed ? 'bad' : ''), kpi('還能借', money(avail), '', S.loanOverdue() ? '逾期中，不能再借' : '')));
    for (const l of r.loans) {
      const left = l.dueDay - day;
      kids.push(el('div', { class: 'ty-contract' + (l.overdue ? ' is-overdue' : '') },
        el('div', { class: 'ty-opt-t' }, el('b', { text: `貸款 #${l.id}　欠 ${money(l.owed)}` }),
          el('span', { class: l.overdue || left <= 2 ? 'ty-no' : '', text: l.overdue ? '已逾期' : `剩 ${left} 日` })),
        el('div', { class: 'ty-opt-s', text: `本金 ${money(l.principal)}　每日利息 ${money(Eco.loanInterest(bal, l))}（${((l.overdue ? L.overdueRate : L.dailyRate) * 100).toFixed(1)}%）${l.overdue ? `　逾期每日聲望 −${L.overdueDailyRep}` : ''}` })));
    }
    const borrow = el('div', { class: 'ty-choices ty-borrow', role: 'group', 'aria-label': '申請貸款' });
    const seen = new Set();
    L.steps.forEach((fr, i) => {
      const amt = Math.floor(avail * fr / 100) * 100;
      if (seen.has(amt)) return; seen.add(amt);
      borrow.append(el('button', { class: 'ty-btn', type: 'button', disabled: amt < L.minBorrow, 'data-fk': 'borrow-' + i, 'data-tut': 'btn-borrow',
        onclick: () => { const x = S.takeLoan(amt); toast(x.ok ? `貸款 ${money(amt)} 入帳，${L.termDays} 日內要還` : x.reason); } },
      el('b', { text: `借 ${money(amt)}` }), el('div', { class: 'ty-opt-s', text: fr >= 1 ? '額度全開' : `額度的 ${Math.round(fr * 100)}%` })));
    });
    kids.push(borrow);
    kids.push(el('p', { class: 'ty-muted', text: `日利率 ${(L.dailyRate * 100).toFixed(1)}%（累加到欠款），${L.termDays} 日內要還；逾期聲望 −${L.overdueRep}、利率加倍、還清前不能再借。可隨時提前還款。` }));
    if (owed > 0) {
      const half = Math.max(1, Math.min(Math.floor(owed / 2), Math.floor(r.money)));
      kids.push(el('div', { class: 'ty-choices', role: 'group', 'aria-label': '還款' },
        el('button', { class: 'ty-btn', type: 'button', disabled: r.money < 1, 'data-fk': 'repay-half', onclick: () => { const x = S.repayLoan(Math.floor(owed / 2)); toast(x.ok ? `已還款 ${money(x.paid)}` : x.reason); } }, `還一半（${money(Math.min(half, Math.floor(owed / 2)))}）`),
        el('button', { class: 'ty-btn ty-btn--primary', type: 'button', disabled: r.money < owed, 'data-fk': 'repay-all', onclick: () => { const x = S.repayLoan(owed); toast(x.ok ? `貸款還清，付出 ${money(x.paid)}` : x.reason); } }, `全部還清（${money(owed)}）`)));
    }
    // 緊急出清
    const inv = r.inv[cur];
    if (inv > 0) {
      const q = S.emergencyQuote(cur), normal = S.sellQuote(cur, Math.min(inv, S.sellRoom(cur)));
      const reserved = r.contracts.active.filter(c => c.fabId === cur).reduce((a, c) => a + c.qty, 0);
      const k = 'em:' + cur;
      kids.push(el('div', { class: 'ty-choices' },
        el('button', { class: 'ty-btn' + (isArmed(k) ? ' ty-btn--danger' : ''), type: 'button', 'data-fk': 'emergency', 'data-tut': 'btn-emergency',
          onclick: () => {
            if (!isArmed(k)) { arm(k); return; }
            disarm(); const x = S.emergencySell(cur); toast(x.ok ? `緊急出清 ${x.n} 片，入帳 ${money(x.revenue)}` : x.reason);
          } },
        el('b', { text: isArmed(k) ? `再按一次確認：出清 ${fmt(inv)} 片，+${money(q)}` : `緊急出清 ${fmt(inv)} 片　+${money(q)}` }),
        el('div', { class: 'ty-opt-s', text: `不受每日需求量限制，但只拿市價的 ${Math.round(bal.emergency.priceMul * 100)}%${normal ? `（正常賣今日可賣的部分 +${money(normal)}）` : ''}${reserved ? `；注意有 ${reserved} 片是訂單要用的` : ''}` }))));
    }
    swap(cashBox, kids);
  }
  const kpi = (k, v, cls, sub) => el('div', { class: 'ty-kpi' + (cls ? ' ty-kpi--' + cls : '') },
    el('div', { class: 'ty-kpi-k', text: k }), el('div', { class: 'ty-kpi-v', text: v }), sub ? el('div', { class: 'ty-kpi-s', text: sub }) : null);

  // ---------- 自動化（每廠一份，滑桿只建一次） ----------
  const autos = new Map();
  function buildAuto(fabId) {
    const A = bal.auto, lot = Eco.lotCost(bal, fabId);
    const gStep = Math.max(50, Math.round(lot / 9 / 50) * 50);
    const row = (id, text, cfg) => {
      const cb = el('input', { type: 'checkbox', id: `ty-au-${fabId}-${id}` });
      const rng = el('input', { type: 'range', min: String(cfg.min), max: String(cfg.max), step: String(cfg.step), 'aria-label': cfg.aria });
      const out = el('output', { 'aria-hidden': 'true' });
      cb.addEventListener('change', () => S.setAuto(fabId, { [cfg.flag]: cb.checked }));
      rng.addEventListener('input', () => { S.setAuto(fabId, { [cfg.key]: +rng.value }, { silent: true }); out.textContent = cfg.fmt(+rng.value); });
      rng.addEventListener('change', () => S.commit());
      return { cb, rng, out, cfg, node: el('div', { class: 'ty-auto-row' }, el('label', { class: 'ty-check', for: cb.id }, cb, ' ', text), el('div', { class: 'ty-auto-ctl' }, rng, out)) };
    };
    const rows = [
      row('sell', '價格指數達門檻就自動賣出（每日結算時，遵守每日需求量、不動訂單保留量）', { flag: 'sell', key: 'sellIdx', min: A.sellIdxMin, max: A.sellIdxMax, step: A.sellIdxStep, fmt: v => `≥ ${(+v).toFixed(2)}`, aria: '自動賣出的價格指數門檻' }),
      row('inv', `庫存達 N 片就自動賣到 ${Math.round(A.invKeepFrac * 100)}%（避免庫存頂到暫停投片）`, { flag: 'inv', key: 'invN', min: A.invMin, max: A.invMax, step: A.invStep, fmt: v => `≥ ${v} 片`, aria: '自動賣出的庫存門檻' }),
      row('guard', '低現金防護：現金低於門檻時，自動改成「只做完在製品」並請林姐通知', { flag: 'guard', key: 'guardCash', min: 0, max: lot * 8, step: gStep, fmt: v => `< ${money(v)}`, aria: '低現金防護的現金門檻' })
    ];
    const node = el('div', {}, el('h4', { class: 'ty-sub', text: '自動化（這座廠）' }),
      el('p', { class: 'ty-muted', text: '預設全部關閉。自動賣出和防護只幫你省手，不會幫你賺更多：仍然要自己看行情。' }), ...rows.map(r => r.node));
    const sync = () => {
      const a = S.getState().fabs[fabId].auto;
      for (const r of rows) {
        const key = r.cfg.key, flag = r.cfg.flag;
        if (document.activeElement !== r.cb) r.cb.checked = !!a[flag];
        if (document.activeElement !== r.rng) {
          const v = a[key] > 0 || key !== 'guardCash' ? a[key] : Eco.guardDefault(bal, fabId);
          r.rng.max = String(Math.max(+r.rng.max, v));
          r.rng.value = String(v);
          r.out.textContent = r.cfg.fmt(v);
        }
      }
    };
    return { node, sync };
  }
  function renderAuto() {
    const cur = getCur();
    if (!S.getState().fabs[cur]?.unlocked) { autoHost._cur = null; fill(autoHost); return; }
    let a = autos.get(cur);
    if (!a) { a = buildAuto(cur); autos.set(cur, a); }
    if (autoHost._cur !== cur) { autoHost._cur = cur; fill(autoHost, a.node); }
    a.sync();
  }

  function render() { renderMode(); renderCash(); renderAuto(); }
  for (const e of ['state:changed', 'day', 'event:end']) bus.on(e, render);
  bus.on('state:reset', () => { autos.clear(); autoHost._cur = null; autoHost._html = null; modeBox._html = cashBox._html = null; disarm(); render(); });
  bus.on('tick', () => { if (S.getState().clock.tick % 2 === 0) render(); });
  render();
  return { render };
}
