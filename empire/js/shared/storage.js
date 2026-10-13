// localStorage 存檔：key、version、migrate（§7.2）
export const SAVE_KEY = 'waferEmpire.save';
export const SAVE_VERSION = 3;
// migrations[v] 把 version v 的存檔轉成 v+1
export const migrations = {
  // v1 → v2：加入市場（需求指數、庫齡、今日已售、價格歷史）、客戶訂單、各廠產線轉速
  1: raw => {
    const s = { ...raw, version: 2 };
    const res = { ...(raw.res || {}) };
    const inv = res.inv || {};
    const zero = {}; for (const k of Object.keys(inv)) zero[k] = 0;
    res.demandIdx = res.demandIdx ?? 1;
    res.invAge = res.invAge || { ...zero };
    res.soldToday = res.soldToday || { ...zero };
    res.priceHist = res.priceHist || [res.priceWalk ?? 1];
    const day = Math.floor(((raw.clock && raw.clock.tick) || 0) / 24);
    res.contracts = res.contracts || { offers: [], active: [], nextId: 1, nextOfferDay: day + 3 };
    s.res = res;
    s.fabs = {};
    for (const [id, f] of Object.entries(raw.fabs || {})) s.fabs[id] = { ...f, rate: f.rate ?? 1 };
    return s;
  },
  // v2 → v3：產線狀態（運轉／只做完在製品／暫停／封存）、暖機、自動化設定、貸款
  2: raw => {
    const s = { ...raw, version: 3 };
    s.res = { ...(raw.res || {}) };
    s.res.loans = Array.isArray(s.res.loans) ? s.res.loans : [];
    s.res.nextLoanId = s.res.nextLoanId ?? 1;
    s.fabs = {};
    for (const [id, f] of Object.entries(raw.fabs || {})) {
      s.fabs[id] = { ...f, mode: f.mode ?? 'run', ramp: f.ramp ?? 0,
        auto: { sell: false, sellIdx: 1.1, inv: false, invN: 250, guard: false, guardCash: 0, hold: false, ...(f.auto || {}) } };
    }
    return s;
  }
};

export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.version) || raw.version < 1) {
    return { ok: false, reason: 'invalid' };
  }
  if (raw.version > SAVE_VERSION) return { ok: false, reason: 'too-new', version: raw.version };
  let s = raw;
  while (s.version < SAVE_VERSION) {
    const f = migrations[s.version];
    if (!f) return { ok: false, reason: 'invalid' };
    s = f(s);
  }
  return { ok: true, save: s };
}

function store(storage) {
  try { return storage || globalThis.localStorage || null; } catch (e) { return null; }
}

export function parseSaveText(text) {
  try { return migrate(JSON.parse(text)); } catch (e) { return { ok: false, reason: 'invalid' }; }
}

export function loadSave(storage) {
  try {
    const st = store(storage);
    const text = st && st.getItem(SAVE_KEY);
    if (!text) return { ok: false, reason: 'none' };
    return parseSaveText(text);
  } catch (e) { return { ok: false, reason: 'unavailable' }; }
}

export function writeSave(save, storage) {
  try {
    const st = store(storage);
    if (!st) return false;
    st.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (e) { return false; }
}

export function clearSave(storage) {
  try { store(storage)?.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
