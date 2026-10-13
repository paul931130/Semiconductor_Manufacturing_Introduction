// 「Q版寫實」機台插畫：全部是 inline SVG 字串（viewBox 0 0 80 62），顏色/動畫由 css/fab-art.css 控制。
// 約定的 class：fa-front/fa-top/fa-side（三面著色，由 --fa-* 變數與等級決定）、fa-d（暗部）、fa-g（玻璃）、
// fa-glow（忙碌時發光/脈動）、fa-spin / fa-dash / fa-slide / fa-bub（忙碌時動畫）。
// 外層 <svg> 的 class 為 `fa-m fa-k-<kind> fa-L<level>`。結果依 (kind, level) 快取，不會每 tick 重建。

const cache = new Map();

/** 3/4 視角的方塊：前面 + 頂面 + 右側面；d 為深度 */
const box = (x, y, w, h, d, cls = '', r = 2.5) => {
  const dx = d * 0.7, dy = d * 0.5;
  return `<path class="fa-top ${cls}" d="M${x} ${y}l${dx} ${-dy}h${w}l${-dx} ${dy}z"/>`
    + `<path class="fa-side ${cls}" d="M${x + w} ${y}l${dx} ${-dy}v${h}l${-dx} ${dy}z"/>`
    + `<rect class="fa-front ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
};
/** 圓柱：頂面橢圓 + 圓角底 */
const cyl = (cx, top, w, h, cls = '') => {
  const rx = w / 2, ry = w / 5;
  return `<path class="fa-front ${cls}" d="M${cx - rx} ${top}v${h}a${rx} ${ry} 0 0 0 ${w} 0v${-h}z"/>`
    + `<ellipse class="fa-top ${cls}" cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}"/>`;
};
const win = (x, y, w, h, extra = '') => `<rect class="fa-g ${extra}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.8"/>`;
const knob = (x, y) => `<circle class="fa-d" cx="${x}" cy="${y}" r="1.1"/>`;
const shadow = '<ellipse class="fa-shadow" cx="40" cy="56" rx="35" ry="4"/>';

const ART = {
  wet_bench: () => `${box(5, 32, 54, 20, 14, '')}
    ${[16, 30, 44].map(x => `<ellipse class="fa-liq fa-dash" cx="${x + 6}" cy="${28}" rx="6" ry="2.4"/>`).join('')}
    <rect class="fa-d" x="9" y="14" width="56" height="3" rx="1.5"/>
    <g class="fa-slide"><rect class="fa-d" x="30" y="17" width="3" height="7"/><rect class="fa-front" x="27" y="23" width="9" height="3" rx="1"/></g>
    <rect class="fa-front" x="54" y="12" width="9" height="12" rx="2"/>
    ${win(9, 36, 24, 11)}${win(37, 36, 16, 11)}${knob(56, 42)}${knob(56, 47)}`,

  single_wafer_cleaner: () => `${box(10, 24, 40, 28, 12, '')}
    <circle class="fa-g" cx="30" cy="38" r="10"/><circle class="fa-spin fa-ring" cx="30" cy="38" r="7" fill="none" stroke-dasharray="4 3"/>
    <circle class="fa-liq" cx="30" cy="38" r="2.2"/>
    <rect class="fa-d" x="44" y="26" width="3" height="10" rx="1.5"/>
    ${box(54, 34, 14, 18, 8, 'fa-dk')}${win(57, 38, 8, 6)}${knob(61, 48)}
    <rect class="fa-d" x="18" y="14" width="22" height="3" rx="1.5"/><rect class="fa-front" x="25" y="17" width="3" height="6"/>`,

  furnace: () => `${box(8, 40, 56, 12, 10, '')}
    ${cyl(30, 12, 26, 30, '')}
    <rect class="fa-glow fa-orange" x="23" y="16" width="14" height="25" rx="6"/>
    ${[19, 25, 31, 37].map(y => `<path class="fa-ring" d="M17 ${y}a13 3 0 0 0 26 0" fill="none"/>`).join('')}
    <rect class="fa-d" x="27" y="4" width="6" height="8" rx="2"/><ellipse class="fa-top" cx="30" cy="12" rx="7" ry="2.4"/>
    ${box(50, 28, 14, 14, 8, 'fa-dk')}${win(53, 31, 8, 6)}
    ${knob(14, 46)}${knob(20, 46)}`,

  cvd_chamber: () => `${box(6, 32, 16, 20, 7, 'fa-dk')}${knob(14, 46)}
    ${cyl(40, 24, 34, 26, '')}
    <circle class="fa-d" cx="40" cy="38" r="8"/><circle class="fa-glow fa-teal" cx="40" cy="38" r="6"/>
    <path class="fa-pipe" d="M40 20v-8h18v10M58 22v8"/>
    ${box(52, 4, 16, 10, 6, '')}
    <path class="fa-pipe" d="M57 44h12v8"/><circle class="fa-front" cx="68" cy="52" r="3.5"/>`,

  pvd_sputter: () => `${cyl(34, 28, 42, 22, '')}
    ${cyl(34, 14, 22, 16, 'fa-dk')}
    <ellipse class="fa-glow fa-violet" cx="34" cy="40" rx="15" ry="4.5"/><ellipse class="fa-ring" cx="34" cy="40" rx="15" ry="4.5" fill="none"/>
    ${win(20, 33, 10, 6)}
    <rect class="fa-d" x="29" y="8" width="10" height="6" rx="2"/>
    ${box(58, 32, 14, 20, 8, 'fa-dk')}${win(60, 36, 8, 7)}${knob(65, 48)}`,

  coater_developer: () => `${box(4, 30, 68, 22, 8, '')}
    ${[8, 24, 40, 56].map(x => `${win(x, 34, 12, 11, 'fa-lit')}`).join('')}
    ${box(8, 18, 16, 12, 5, 'fa-dk')}${box(32, 18, 16, 12, 5, 'fa-dk')}
    <circle class="fa-front" cx="58" cy="22" r="6"/><g class="fa-spin"><rect class="fa-d" x="57" y="14" width="2.4" height="10" rx="1"/><rect class="fa-d" x="57" y="21" width="9" height="2.4" rx="1"/></g>
    ${knob(10, 49)}${knob(16, 49)}<rect class="fa-lit" x="46" y="47" width="22" height="2.4" rx="1"/>`,

  scanner: () => `${box(6, 24, 52, 28, 14, '')}
    ${box(18, 8, 28, 16, 8, 'fa-dk')}
    <rect class="fa-d" x="29" y="3" width="6" height="6" rx="2"/>
    <circle class="fa-d" cx="32" cy="18" r="6.5"/><circle class="fa-glow fa-pink" cx="32" cy="18" r="4.5"/>
    ${win(12, 31, 30, 15)}<rect class="fa-glow fa-pink" x="16" y="36" width="22" height="5" rx="2"/>
    ${knob(48, 34)}${knob(48, 40)}${knob(48, 46)}
    ${box(60, 32, 12, 20, 6, 'fa-dk')}${win(62, 36, 8, 6)}`,

  etch_chamber: () => `${cyl(36, 26, 38, 24, '')}
    ${box(24, 10, 24, 11, 6, 'fa-dk')}<rect class="fa-d" x="33" y="20" width="6" height="6"/>
    <ellipse class="fa-d" cx="36" cy="39" rx="13" ry="7.5"/><ellipse class="fa-glow fa-purple" cx="36" cy="39" rx="10.5" ry="5.6"/>
    <path class="fa-spark" d="M30 38l3 -2l2 3l3 -3l3 3l3 -2" fill="none"/>
    ${box(58, 34, 14, 18, 8, 'fa-dk')}${win(60, 38, 8, 7)}${knob(65, 49)}
    <path class="fa-pipe" d="M18 30h-8v20"/>`,

  implanter: () => `${box(3, 30, 18, 22, 8, '')}
    ${cyl(12, 18, 12, 14, 'fa-dk')}
    <rect class="fa-d" x="21" y="38" width="34" height="8" rx="3"/>
    <rect class="fa-beam fa-glow fa-cyan" x="21" y="40.5" width="34" height="3" rx="1.5"/>
    ${box(27, 31, 9, 15, 5, 'fa-dk')}${box(41, 31, 9, 15, 5, 'fa-dk')}
    ${box(55, 28, 20, 24, 8, '')}${win(58, 33, 12, 9)}${knob(64, 47)}`,

  rta: () => `${box(10, 26, 46, 26, 12, '')}
    ${win(16, 33, 32, 11)}
    ${[19, 25, 31, 37, 43].map(x => `<rect class="fa-glow fa-orange" x="${x}" y="35" width="3" height="7" rx="1.2"/>`).join('')}
    ${[16, 24, 32].map(x => `<rect class="fa-d" x="${x}" y="20" width="5" height="2.2" rx="1"/>`).join('')}
    ${knob(18, 48)}${knob(24, 48)}<rect class="fa-lit" x="34" y="47" width="16" height="2.2" rx="1"/>
    ${box(60, 38, 12, 14, 6, 'fa-dk')}`,

  cmp_tool: () => `${box(4, 38, 64, 14, 12, '')}
    <ellipse class="fa-d" cx="30" cy="34" rx="24" ry="8.5"/>
    <ellipse class="fa-pad" cx="30" cy="34" rx="21" ry="7.2"/>
    <ellipse class="fa-dash fa-ring" cx="30" cy="34" rx="14" ry="4.6" fill="none" stroke-dasharray="5 4"/>
    <ellipse class="fa-dash fa-ring" cx="30" cy="34" rx="7" ry="2.3" fill="none" stroke-dasharray="3 3"/>
    ${cyl(30, 14, 12, 12, 'fa-dk')}<g class="fa-slide"><rect class="fa-d" x="30" y="10" width="26" height="3" rx="1.5"/></g>
    <circle class="fa-liq fa-bub" cx="50" cy="30" r="1.6"/>
    ${box(56, 22, 14, 22, 6, 'fa-dk')}${win(58, 26, 10, 7)}`,

  electroplating_tool: () => `${box(5, 30, 50, 22, 12, '')}
    ${[14, 28, 42].map(x => `<ellipse class="fa-d" cx="${x + 6}" cy="27" rx="7" ry="2.8"/><ellipse class="fa-liq fa-cu fa-dash" cx="${x + 6}" cy="27" rx="5.5" ry="2"/>`).join('')}
    <circle class="fa-liq fa-bub" cx="20" cy="22" r="1.4"/><circle class="fa-liq fa-bub fa-b2" cx="48" cy="21" r="1.2"/>
    ${win(9, 35, 26, 10)}${knob(42, 40)}${knob(48, 40)}
    ${box(58, 14, 14, 38, 5, 'fa-dk')}${win(60, 18, 10, 6)}<rect class="fa-glow fa-cu" x="60" y="28" width="10" height="3" rx="1"/>`,
};

// 出貨站：輸送帶 + 量測（metrology）機 + 包裝箱
const DOCK = () => `${box(2, 42, 76, 9, 6, 'fa-dk')}
    <rect class="fa-conv" x="6" y="44" width="68" height="4" rx="2"/><path class="fa-dash fa-ring" d="M7 46h66" stroke-dasharray="3 5"/>
    ${box(46, 14, 22, 24, 7, '')}<circle class="fa-d" cx="57" cy="26" r="6"/><circle class="fa-glow fa-cyan" cx="57" cy="26" r="3.5"/>
    <rect class="fa-d" x="55" y="8" width="4" height="7" rx="1.5"/>
    ${box(8, 30, 12, 11, 5, 'fa-pk')}${box(23, 33, 12, 8, 4, 'fa-pk')}`;

const GHOST = () => `<path class="fa-ghost" d="M10 30h52v22H10zM10 30l10-7h52l-10 7M62 30l10-7v22l-10 7"/>
    <path class="fa-ghost" d="M32 41h8M36 37v8"/>`;

/** 光塔（Level 越高越完整） */
const tower = (lv) => {
  if (lv < 3) return '';
  const n = lv >= 5 ? 3 : lv === 4 ? 2 : 1, h = 6 + n * 6;
  const lamps = ['fa-lr', 'fa-ly', 'fa-lg'].slice(3 - n).map((c, i) => `<rect class="fa-lamp ${c}" x="74.2" y="${50 - h + i * 5.4}" width="4.6" height="5" rx="1.4"/>`).join('');
  return `<rect class="fa-d" x="75.6" y="${50 - h}" width="1.8" height="${h + 4}"/>${lamps}`;
};
const pips = (lv) => [0, 1, 2, 3, 4].map(i => `<circle class="fa-pip${i < lv ? ' fa-pip-on' : ''}" cx="${6 + i * 4.4}" cy="59.5" r="1.4"/>`).join('');

export function machineSVG(kind, level) {
  const key = kind + '|' + level;
  let s = cache.get(key);
  if (s) return s;
  const art = (ART[kind] || (() => box(10, 26, 52, 26, 12, '')))();
  s = `<svg class="fa-m fa-k-${kind in ART ? kind : 'generic'} fa-L${level}" viewBox="0 0 80 62" aria-hidden="true" focusable="false">${shadow}${art}${tower(level)}${pips(level)}</svg>`;
  cache.set(key, s);
  return s;
}
export function dockSVG() {
  return cache.get('dock') || (cache.set('dock', `<svg class="fa-m fa-k-dock fa-L3" viewBox="0 0 80 62" aria-hidden="true" focusable="false">${shadow}${DOCK()}</svg>`), cache.get('dock'));
}
export function ghostSVG() {
  return cache.get('ghost') || (cache.set('ghost', `<svg class="fa-m fa-k-ghost" viewBox="0 0 80 62" aria-hidden="true" focusable="false">${GHOST()}</svg>`), cache.get('ghost'));
}
