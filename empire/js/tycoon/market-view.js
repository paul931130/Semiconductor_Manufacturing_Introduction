// 市場與訂單面板 + 營運選擇（產線轉速）。賣不賣、何時賣、接不接單、轉速多快，都是玩家的決定。
import { bus } from '../shared/bus.js';
import * as S from './state.js';
import * as Eco from './economy.js';
import * as Ev from './events.js';
import { fabStatsNow } from './sim.js';
import { el, fill, toast, money, fmt, pct } from './ui.js';

const BARS = '▁▂▃▄▅▆▇█';
const spark = (hist, bal) => hist.map(v => BARS[Math.max(0, Math.min(7, Math.round((v - bal.market.priceMin) / (bal.market.priceMax - bal.market.priceMin) * 7)))]).join('');

export function mountMarket(root, getCur) {
  const bal = S.getBal();
  const box = el('section', { class: 'ty-market', 'aria-label': '市場與訂單' });
  root.append(box);

  function render() {
    const s = S.getState(), r = s.res, cur = getCur(), fab = s.fabs[cur];
    if (!fab?.unlocked) { fill(box); return; }
    const hist = r.priceHist || [r.priceWalk];
    const prev = hist.length > 1 ? hist[hist.length - 2] : r.priceWalk;
    const arrow = r.priceWalk > prev + 0.004 ? '▲' : r.priceWalk < prev - 0.004 ? '▼' : '■';
    const D = S.demandToday(), room = S.sellRoom(cur), inv = r.inv[cur], age = r.invAge[cur] || 0;
    const fresh = Eco.freshness(bal, age);
    const hold = Math.round(Eco.holdCost(bal, cur, inv));
    const mood = r.priceWalk >= 1.1 ? '行情好，適合出貨' : r.priceWalk <= 0.9 ? '行情低迷，可以囤一下（但庫存會老化）' : '行情普通';

    const sellBtn = (label, frac, tut) => {
      const n = frac >= 1 ? room : Math.min(room, Math.ceil(inv * frac));
      const q = n > 0 ? S.sellQuote(cur, n) : 0;
      return el('button', { class: 'ty-btn' + (frac >= 1 ? ' ty-btn--primary' : ''), disabled: n <= 0, 'data-tut': tut,
        text: n > 0 ? `${label}（${n} 片 +${money(q)}）` : label,
        onclick: () => { const x = S.sellInventory(cur, n); if (x.ok) toast(`賣出 ${x.n} 片，入帳 ${money(x.revenue)}`); else toast(x.reason); } });
    };

    const body = [
      el('h3', { class: 'ty-sec', text: '市場與訂單' }),
      el('div', { class: 'ty-mkt-row' },
        el('div', { class: 'ty-kpi' }, el('div', { class: 'ty-kpi-k', text: '價格指數' }),
          el('div', { class: 'ty-kpi-v', text: `${r.priceWalk.toFixed(2)} ${arrow}` }),
          el('div', { class: 'ty-kpi-s ty-spark', text: spark(hist, bal), 'aria-label': `近 ${hist.length} 日價格走勢` })),
        el('div', { class: 'ty-kpi' }, el('div', { class: 'ty-kpi-k', text: '需求指數' }),
          el('div', { class: 'ty-kpi-v', text: r.demandIdx.toFixed(2) }),
          el('div', { class: 'ty-kpi-s', text: `每廠每日最多賣 ${D} 片` }))),
      el('p', { class: 'ty-muted', text: `${mood}。一天賣越多，單價被壓得越低（最多約 −${Math.round(bal.market.slip * 100)}%）。` }),
      el('div', { class: 'ty-inv-box' },
        el('b', { text: `${bal.fabs[cur].zh} 庫存 ${fmt(inv)} 片` }),
        el('span', { text: `　平均庫齡 ${age.toFixed(1)} 日　新鮮度 ${pct(fresh, 0)}　倉儲 ${money(hold)}/日` }),
        el('div', { class: 'ty-muted', text: `今日已賣 ${r.soldToday[cur] || 0} 片，還能賣 ${Math.min(inv, Eco.sellRoom(D, r.soldToday[cur] || 0))} 片。庫存每放一日，售價 −${Math.round(bal.market.ageDecay * 100)}%（最低 ${Math.round(bal.market.ageFloor * 100)}%）並付倉儲費；庫存達 ${bal.startHaltInv} 片產線就暫停投片；硬上限 ${bal.invCap} 片，超出的報廢。` })),
      el('div', { class: 'ty-choices ty-sell' }, sellBtn('賣 1/3', 1 / 3, 'btn-sell-third'), sellBtn('賣一半', 0.5, 'btn-sell-half'), sellBtn('全部賣出', 1, 'btn-sell-all'))
    ];

    // ---- 訂單 ----
    const cs = r.contracts;
    body.push(el('h3', { class: 'ty-sec', text: `客戶訂單（進行中 ${cs.active.length} / ${bal.contracts.maxActive}）` }));
    if (!cs.offers.length && !cs.active.length) body.push(el('p', { class: 'ty-muted', text: '目前沒有訂單。產線齊全後，客戶會每隔幾天來詢價。' }));
    const day = S.currentDay();
    for (const c of cs.active) {
      const chk = S.contractCheck(c, fabStatsNow(c.fabId).Y);
      const left = c.deadline - day;
      body.push(el('div', { class: 'ty-contract is-active' },
        el('div', { class: 'ty-opt-t' }, el('b', { text: `${bal.fabs[c.fabId].zh}　${c.qty} 片　${money(Eco.contractPayout(c))}` }),
          el('span', { class: left <= 1 ? 'ty-no' : '', text: `剩 ${left} 日` })),
        el('div', { class: 'ty-opt-s', text: `單價 ${money(c.unitPrice)}（比平常高 ${Math.round((c.premium - 1) * 100)}%）　逾期違約金 ${money(c.penalty)}` }),
        el('div', { class: 'ty-opt-s' },
          el('span', { class: chk.stockOk ? 'ty-ok' : 'ty-no', text: `庫存 ${chk.have} / ${c.qty}` }), '　',
          el('span', { class: chk.yieldOk ? 'ty-ok' : 'ty-no', text: `線良率 ${pct(chk.yNow)} / 要求 ≥ ${pct(c.minY, 0)}` })),
        el('button', { class: 'ty-btn ty-btn--primary', text: '交貨', 'data-tut': 'btn-deliver',
          onclick: () => { const x = S.deliverContract(c.id, fabStatsNow(c.fabId).Y); toast(x.ok ? `交貨完成，入帳 ${money(x.pay)}` : x.reason); } })));
    }
    for (const o of cs.offers) {
      const left = o.offerEnd - day;
      const yNow = fabStatsNow(o.fabId).Y, short = yNow < o.minY;
      body.push(el('div', { class: 'ty-contract' },
        el('div', { class: 'ty-opt-t' }, el('b', { text: `新訂單：${bal.fabs[o.fabId].zh}　${o.qty} 片　${money(Eco.contractPayout(o))}` }), el('span', { text: `報價剩 ${left} 日` })),
        el('div', { class: 'ty-opt-s', text: `單價 ${money(o.unitPrice)}（比平常高 ${Math.round((o.premium - 1) * 100)}%，不受行情影響）　良率須 ≥ ${pct(o.minY, 0)}${o.stretch ? '（挑戰單：要求高於現況）' : ''}　接單後 ${o.days} 日內交貨　違約金 ${money(o.penalty)}` }),
        short && el('div', { class: 'ty-warn', role: 'status', text: `警告：目前線良率 ${pct(yNow)} 低於要求 ${pct(o.minY, 0)}。要先升級或調慢轉速拉高良率，否則交不了貨、要賠違約金 ${money(o.penalty)}。` }),
        el('div', { class: 'ty-choices' },
          el('button', { class: 'ty-btn ty-btn--primary', text: short ? '接單（良率不足）' : '接單',
            onclick: function () {
              if (short && !this.dataset.armed) { this.dataset.armed = '1'; this.textContent = `確定？良率目前不夠，再按一次接單`; return; }
              const x = S.acceptContract(o.id); if (!x.ok) toast(x.reason);
            } }),
          el('button', { class: 'ty-btn', text: '婉拒', onclick: () => S.declineContract(o.id) }))));
    }

    // ---- 營運選擇：產線轉速 ----
    body.push(el('h3', { class: 'ty-sec', text: '營運選擇：產線轉速' }));
    body.push(el('p', { class: 'ty-muted', text: '轉速越快產能越高，但缺陷率與出事機率也跟著上升；太慢又賺不到錢。數字是標準行情下的預估日利潤。' }));
    const Sr = S.starRatio(cur);
    const row = el('div', { class: 'ty-choices ty-rate', role: 'group', 'aria-label': '產線轉速' });
    const names = { 0.7: '慢速', 1: '標準', 1.2: '加速', 1.4: '極速' };
    for (const rt of bal.rate.steps) {
      const mods = Ev.eventModifiers(bal, { ...fab, rate: rt });
      const p = Eco.lineProjection(bal, cur, fab, Sr, mods, r.rep, 1, 1);
      row.append(el('button', { class: 'ty-btn' + ((fab.rate ?? 1) === rt ? ' is-on' : ''), 'aria-pressed': String((fab.rate ?? 1) === rt), 'data-tut': 'rate-' + rt,
        onclick: () => S.setRate(cur, rt) },
        el('b', { text: `${names[rt] || ''} ×${rt}` }),
        el('div', { class: 'ty-opt-s', text: p.complete ? `良率 ${pct(p.Y)}` : '—' }),
        el('div', { class: 'ty-opt-s', text: p.complete ? `${p.profitPerDay >= 0 ? '+' : '−'}${money(Math.abs(p.profitPerDay))}/日` : '產線不通' })));
    }
    body.push(row);
    fill(box, ...body);
  }

  for (const e of ['state:changed', 'day', 'event:end', 'state:reset']) bus.on(e, render);
  bus.on('tick', () => { if (S.getState().clock.tick % 4 === 0) render(); });
  render();
  return { render };
}
