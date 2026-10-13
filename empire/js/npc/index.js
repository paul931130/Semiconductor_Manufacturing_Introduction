// NPC 系統入口：廠務經理（林姐）、製程工程師（阿哲）、業務（Vivian）。
// window.EmpireNpc：{ eventDialog, claimToast, settingControl, say } 供 hud 等模組以「有就用」的方式掛接。
import { bus } from '../shared/bus.js';
import * as S from '../tycoon/state.js';
import { getEquipment } from '../shared/content.js';
import { money } from '../tycoon/ui.js';
import { loadDialogue, setProbes, say, presentBlocking, hasDialogue, npcInfo, lineText, getMode, setMode } from './dialogue.js';
import { installTriggers, setTriggerProbes, claimToast } from './triggers.js';
import { portraitSvg } from './portraits.js';
import { typewrite, reducedMotion } from './type.js';

export { portraitSvg, typewrite, reducedMotion, lineText, npcInfo, say, getMode, setMode, hasDialogue };

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** 事件對話：保留事件的選項按鈕與知識卡，放進對話框；回傳 true 表示已接手 */
function eventDialog(ctx) {
  const { fabId, d, bal, choose, done } = ctx;
  const s = S.getState();
  const fab = s.fabs[fabId];
  const ev = fab.event;
  const slot = ev?.extra?.slot != null ? fab.slots[ev.extra.slot] : null;
  const tool = (slot && getEquipment(slot.equip)?.zh) || '機台';
  const vars = {
    fab: bal.fabs[fabId].zh, tool, mul: bal.events.rushPriceMul, days: bal.events.rushDays,
    cleanDays: bal.events.particleDays, outage: bal.events.outageHaltTicks
  };
  const lineId = 'ev.' + d.id + (d.id === 'power_outage' && fab.ups ? '.ups' : '');
  const title = `${bal.fabs[fabId].zh}：${d.title}`;
  let picked = null;

  presentBlocking({
    id: lineId, vars, label: title,
    build: ({ close }) => {
      const err = el('p', 'ty-err npc-err');
      err.setAttribute('aria-live', 'polite');
      const btns = el('div', 'ty-choices npc-choices');
      for (const c of d.choices) {
        const b = el('button', 'ty-btn ty-btn--primary', c.label + (c.cost ? `　${money(c.cost)}` : ''));
        b.type = 'button';
        b.disabled = !!c.disabled;
        b.setAttribute('data-tut', 'event-' + c.id);
        b.addEventListener('click', () => {
          const r = choose(c.id);
          if (!r.ok) { err.textContent = r.reason || '無法執行'; return; }
          picked = c.id;
          close('choice');
        });
        btns.append(b);
      }
      const fact = el('div', 'ty-factcard');
      fact.append(el('div', 'ty-factcard-h', '你知道嗎'), el('p', null, d.factText));
      const head = el('div', 'npc-evt-h', title);
      const eff = el('p', 'npc-effect', d.effect);
      return [head, eff, btns, err, fact];
    }
  }).then(() => {
    done();
    if (picked) say(`ev.${d.id}.${picked}`, { vars, pri: 'normal', force: true });
  });
  return true;
}

function settingControl(cls = 'we-btn') {
  const b = el('button', cls + ' npc-mode');
  b.type = 'button';
  const sync = () => {
    const lite = getMode() === 'lite';
    b.textContent = lite ? 'NPC 對話：精簡' : 'NPC 對話：完整';
    b.setAttribute('aria-label', lite ? 'NPC 對話：精簡，只顯示重要訊息。按一下切換為完整' : 'NPC 對話：完整。按一下切換為精簡（只顯示重要訊息）');
    b.setAttribute('aria-pressed', String(lite));
  };
  b.addEventListener('click', () => { setMode(getMode() === 'lite' ? 'full' : 'lite'); });
  bus.on('npc:mode', sync);
  bus.on('state:reset', sync);
  sync();
  return b;
}

let started = false;
export async function initNpc({ tutorialActive } = {}) {
  await loadDialogue();
  const probe = { tutorialActive: tutorialActive || (() => false) };
  setProbes(probe);
  setTriggerProbes(probe);
  if (!started) {
    started = true;
    installTriggers();
  }
  window.EmpireNpc = { eventDialog, claimToast, settingControl, say, lineText };
  return window.EmpireNpc;
}

export { settingControl as npcModeButton };
