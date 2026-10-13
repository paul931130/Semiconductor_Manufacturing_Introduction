// 斷鏈救援：沒有在製品、沒有庫存、錢又不夠做下一步時，由林姐提供出路（貸款／賣機台／最後手段增資）。
// buildRescue(close) 回傳對話內容節點（NPC 對話框與一般彈窗共用）；showRescue() 負責鎖時鐘並挑選呈現方式。
import { bus } from '../shared/bus.js';
import * as S from './state.js';
import * as Eco from './economy.js';
import * as Clock from './clock.js';
import { getEquipment } from '../shared/content.js';
import { el, fill, openDialog, toast, money } from './ui.js';

let open = false;
export const isRescueOpen = () => open;

export function rescueVars() {
  const bal = S.getBal(), d = S.deadEndInfo();
  return { money: money(S.getState().res.money), need: money(d.need), loan: money(d.loanAvail), grant: money(d.grant), refund: money(d.refund), n: d.equipCount };
}

export function buildRescue(close) {
  const bal = S.getBal();
  const box = el('div', { class: 'ty-rescue', 'data-tut': 'rescue' });
  let listOpen = false;

  function render() {
    const d = S.deadEndInfo();
    if (!d.stuck) { close('solved'); return; }
    const kids = [];
    kids.push(el('p', { class: 'ty-muted', role: 'status', text: `帳上 ${money(S.getState().res.money)}，下一步至少要 ${money(d.need)}；沒有在製品，也沒有庫存可賣。` }));
    const choices = el('div', { class: 'ty-choices npc-choices' });
    const loanAmt = Math.min(d.loanAvail, Math.max(bal.loan.minBorrow, Math.ceil(d.need * 3 / 100) * 100));
    if (d.loanAvail >= bal.loan.minBorrow) {
      choices.append(el('button', { class: 'ty-btn ty-btn--primary', type: 'button', 'data-tut': 'rescue-loan',
        'aria-label': `申請銀行貸款 ${money(loanAmt)}，日利率 ${(bal.loan.dailyRate * 100).toFixed(1)}%，${bal.loan.termDays} 日內要還`,
        onclick: () => { const r = S.takeLoan(loanAmt); if (r.ok) { toast(`貸款 ${money(loanAmt)} 入帳`); close('loan'); } else toast(r.reason); } },
      `申請貸款 ${money(loanAmt)}`, el('div', { class: 'ty-opt-s', text: `日利率 ${(bal.loan.dailyRate * 100).toFixed(1)}%，${bal.loan.termDays} 日內還清` })));
    } else {
      choices.append(el('p', { class: 'ty-warn', text: S.loanOverdue() ? '有逾期未還的貸款，銀行暫時不會再放款。' : '目前的信用額度已經用完了。' }));
    }
    if (d.equipCount > 0) {
      choices.append(el('button', { class: 'ty-btn', type: 'button', 'aria-expanded': String(listOpen), 'data-tut': 'rescue-sell',
        onclick: () => { listOpen = !listOpen; render(); } },
      `出售機台換現金（退 50%）`, el('div', { class: 'ty-opt-s', text: `全部賣掉最多可拿回 ${money(d.refund)}` })));
    }
    if (!d.loanOk) {
      choices.append(el('button', { class: 'ty-btn', type: 'button', 'data-tut': 'rescue-grant',
        onclick: () => { const r = S.rescueGrant(); if (r.ok) { toast(`股東增資 ${money(r.amount)} 入帳，聲望 −${bal.rescue.repLoss}`); close('grant'); } else toast(r.reason); } },
      `股東增資 ${money(d.grant)}`, el('div', { class: 'ty-opt-s', text: `最後手段：聲望 −${bal.rescue.repLoss}，只在貸款解不了時出現` })));
    }
    choices.append(el('button', { class: 'ty-btn', type: 'button', onclick: () => close('later'), text: '我先自己想辦法' }));
    kids.push(choices);
    if (listOpen) {
      kids.push(el('ul', { class: 'ty-rescue-list', 'aria-label': '可出售的機台' }, S.equipList().map(x => {
        const eq = getEquipment(x.equip);
        return el('li', {}, el('button', { class: 'ty-btn', type: 'button',
          onclick: () => { const r = S.sellEquip(x.fabId, x.idx); if (r.ok) { toast(`賣出機台，入帳 ${money(r.refund)}`); render(); } } },
        `${bal.fabs[x.fabId].zh} 槽 ${x.idx + 1}　${eq ? eq.zh : x.equip} L${x.level}　+${money(x.refund)}`));
      })));
    }
    fill(box, kids);
  }
  render();
  return box;
}

/** 顯示救援。有 NPC 對話模組就由林姐出面；否則退回一般彈窗。回傳是否已顯示 */
export function showRescue() {
  if (open) return false;
  open = true;
  Clock.lock();
  const done = () => { open = false; Clock.unlock(); S.commit(); };
  if (window.EmpireNpc?.rescueDialog?.({ build: buildRescue, vars: rescueVars(), done })) return true;
  const dlg = openDialog({ title: '資金斷鏈', kind: 'modal', dismissible: false, label: '資金斷鏈', onClose: done });
  dlg.body.append(el('p', { text: '廠長，資金不夠做下一步了，而且沒有在製品也沒有庫存可賣。下面是幾條出路：' }), buildRescue(r => dlg.close()));
  dlg.panel.querySelector('button:not([disabled])')?.focus();
  return true;
}

export function installRescue() {
  bus.on('state:reset', () => { open = false; });
  bus.on('deadend', () => {
    if (window.EmpireApp?.tut?.isActive?.()) return; // 教學進行中先不打斷
    if (document.getElementById('screen-game')?.hidden) return;
    showRescue();
  });
}
