// NPC 頭像：Q 版寫實風（大頭比例、漸層上色、眼睛高光），全部以內嵌 SVG 產生，無外部圖片。
// portraitSvg(npc, expr) → SVG 字串。npc：facility | engineer | sales；expr：normal | happy | worried | alarmed
export const EXPRS = ['normal', 'happy', 'worried', 'alarmed'];
export const NPC_IDS = ['facility', 'engineer', 'sales'];

let uidN = 0;

// ---------- 五官（三角色共用） ----------
function brows(e, o) {
  const c = o.brow, w = o.browW || 2.2;
  const P = {
    normal: ['M31 44.5 Q37 41 44 43.5', 'M56 43.5 Q63 41 69 44.5'],
    happy: ['M31 43.5 Q37 39.5 44 42.5', 'M56 42.5 Q63 39.5 69 43.5'],
    worried: ['M31 47 Q38 44.5 44 40.8', 'M56 40.8 Q62 44.5 69 47'],
    alarmed: ['M30.5 41.5 Q37 36.5 44 37.8', 'M56 37.8 Q63 36.5 69.5 41.5']
  }[e];
  return P.map(d => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`).join('');
}

function eyes(u, e, o) {
  const y = 53, lash = o.lash;
  const eye = (cx, side) => {
    if (e === 'happy') {
      return `<path d="M${cx - 5.8} ${y + 1.6} Q${cx} ${y - 6} ${cx + 5.8} ${y + 1.6}" fill="none" stroke="${lash}" stroke-width="2.3" stroke-linecap="round"/>`;
    }
    const wide = e === 'alarmed', wor = e === 'worried';
    const rx = wide ? 6.3 : 5.6, ry = wide ? 7.4 : 6;
    const ir = wide ? 2.8 : 3.9;
    const dx = wor ? -side * 0.7 : 0, dy = wor ? 0.9 : 0.3;
    const lid = wide
      ? ''
      : `<path d="M${cx - 6.3} ${y - 1} Q${cx} ${y - 8.6} ${cx + 6.3} ${y - 1}" fill="none" stroke="${lash}" stroke-width="2" stroke-linecap="round"/>`;
    const wing = `<path d="M${cx + side * 5.6} ${y - 2} l${side * 2.4} -1.1" stroke="${lash}" stroke-width="1.3" stroke-linecap="round"/>`;
    return `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"/>`
      + `<ellipse cx="${cx}" cy="${y - ry + 1.6}" rx="${rx - 0.4}" ry="1.9" fill="#000" opacity=".1"/>`
      + `<circle cx="${cx + dx}" cy="${y + dy}" r="${ir}" fill="url(#${u}ir)"/>`
      + `<circle cx="${cx + dx}" cy="${y + dy}" r="${wide ? 1 : 1.9}" fill="#150e0b"/>`
      + `<circle cx="${cx + dx - 1.3}" cy="${y + dy - 1.6}" r="${wor ? 1.7 : 1.3}" fill="#fff"/>`
      + `<circle cx="${cx + dx + 1.3}" cy="${y + dy + 1.5}" r=".6" fill="#fff" opacity=".85"/>`
      + lid + wing
      + `<path d="M${cx - 4.6} ${y + 4.8} Q${cx} ${y + 6.8} ${cx + 4.6} ${y + 4.8}" fill="none" stroke="#9b5e48" stroke-opacity=".35" stroke-width=".9" stroke-linecap="round"/>`;
  };
  return eye(38, -1) + eye(62, 1);
}

function mouth(e, o) {
  const lip = o.lip;
  switch (e) {
    case 'happy':
      return `<path d="M42 65 Q50 76.5 58 65 Q50 67.8 42 65Z" fill="#7d2a2e"/>`
        + `<path d="M43.2 65.4 Q50 68 56.8 65.4 L56 67 Q50 69.2 44 67Z" fill="#fff"/>`
        + `<path d="M46 71 Q50 73.6 54 71 Q50 69.6 46 71Z" fill="#e5786f"/>`
        + `<path d="M42 65 Q50 67.8 58 65" fill="none" stroke="${lip}" stroke-width="1.2" stroke-linecap="round"/>`;
    case 'worried':
      return `<path d="M44 69.6 Q47 66.8 50 68.8 Q53 70.8 56 68" fill="none" stroke="${lip}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'alarmed':
      return `<ellipse cx="50" cy="69" rx="3.9" ry="5.2" fill="#6f2227"/>`
        + `<ellipse cx="50" cy="71.4" rx="2.4" ry="1.9" fill="#d9625a"/>`
        + `<path d="M46.4 65.3 Q50 64 53.6 65.3" fill="none" stroke="${lip}" stroke-width="1.3" stroke-linecap="round"/>`;
    default:
      return `<path d="M44 67 Q50 71 56 67" fill="none" stroke="${lip}" stroke-width="2" stroke-linecap="round"/>`
        + `<path d="M46.5 69.6 Q50 71.4 53.5 69.6" fill="none" stroke="${lip}" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>`;
  }
}

function extras(e, o) {
  const blush = { normal: 0.2, happy: 0.42, worried: 0.12, alarmed: 0 }[e];
  let s = '';
  if (blush) {
    s += `<ellipse cx="30.5" cy="62" rx="5.6" ry="3.3" fill="${o.blush}" opacity="${blush}"/>`
      + `<ellipse cx="69.5" cy="62" rx="5.6" ry="3.3" fill="${o.blush}" opacity="${blush}"/>`;
  }
  s += `<path d="M48.8 59.2 Q50.6 62 52.4 60.6" fill="none" stroke="${o.shade}" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>`;
  if (e === 'worried') {
    s += `<path d="M71.5 33 Q75.5 39.5 71.5 43 Q67.5 39.5 71.5 33Z" fill="#a9ddff" stroke="#5aa6d8" stroke-width=".7"/>`
      + `<circle cx="70.3" cy="38.6" r=".9" fill="#fff" opacity=".9"/>`;
  }
  if (e === 'alarmed') {
    s += `<path d="M42 30.5 v5 M50 29 v6.5 M58 30.5 v5" stroke="#6d7ea8" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>`
      + `<path d="M85 20 l5 -4 M88 30 l6 -1 M82 11 l2 -6" stroke="#ffb347" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  return s;
}

function face(u, e, o) {
  return extras(e, o) + brows(e, o) + eyes(u, e, o) + mouth(e, o);
}

// ---------- 共用零件 ----------
const HEAD = 'M50 17 C70 17 79.5 32 79.5 49 C79.5 66 67.5 78.5 50 78.5 C32.5 78.5 20.5 66 20.5 49 C20.5 32 30 17 50 17Z';
const HOOD_OUT = 'M12 58 C8 22 30 4 50 4 C70 4 92 22 88 58 C88 72 80 82 68 84 L32 84 C20 82 12 72 12 58Z';
const HOOD_IN = 'M50 27 C65 27 75 37 75 51 C75 67 65 79 50 79 C35 79 25 67 25 51 C25 37 35 27 50 27Z';

function defs(u, c) {
  return `<defs>`
    + `<linearGradient id="${u}sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.skin[0]}"/><stop offset="1" stop-color="${c.skin[1]}"/></linearGradient>`
    + `<radialGradient id="${u}ir" cx=".5" cy=".4" r=".65"><stop offset="0" stop-color="${c.iris[0]}"/><stop offset="1" stop-color="${c.iris[1]}"/></radialGradient>`
    + `<linearGradient id="${u}gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.gown[0]}"/><stop offset="1" stop-color="${c.gown[1]}"/></linearGradient>`
    + `<linearGradient id="${u}hd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.hood[0]}"/><stop offset="1" stop-color="${c.hood[1]}"/></linearGradient>`
    + `<linearGradient id="${u}hr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.hair[0]}"/><stop offset="1" stop-color="${c.hair[1]}"/></linearGradient>`
    + `<radialGradient id="${u}bg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset="1" stop-color="${c.bg[1]}"/></radialGradient>`
    + `</defs>`;
}

const bgRect = u => `<rect width="100" height="100" fill="url(#${u}bg)"/>`
  + `<circle cx="84" cy="14" r="22" fill="#fff" opacity=".05"/><circle cx="12" cy="90" r="26" fill="#fff" opacity=".04"/>`;

const neck = (u, c) => `<path d="M42 70 H58 V86 H42Z" fill="url(#${u}sk)"/><path d="M42 74 Q50 82 58 74 V80 Q50 88 42 80Z" fill="${c.shade}" opacity=".35"/>`;
const headShape = (u, c) => `<path d="${HEAD}" fill="url(#${u}sk)"/>`
  + `<path d="M24 56 Q27 72 44 77" fill="none" stroke="${c.shade}" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>`;

function hood(u, c, stitch) {
  return `<path d="${HOOD_OUT} ${HOOD_IN}" fill="url(#${u}hd)" fill-rule="evenodd"/>`
    + `<path d="${HOOD_IN}" fill="none" stroke="${stitch}" stroke-width="1.8"/>`
    + `<path d="${HOOD_IN}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".5" stroke-dasharray="1.6 1.6" transform="translate(0 -1.1)"/>`
    + `<path d="M26 16 Q50 -1 74 16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`
    + `<path d="M17 62 Q18 75 28 81" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="3" stroke-linecap="round"/>`;
}

// ---------- 角色 ----------
const CHARS = {
  // 廠務經理 林姐：白色無塵衣＋口罩拉在下巴、對講機、橘色吊繩
  facility: {
    skin: ['#fbdcc2', '#eebb99'], shade: '#b9755a', iris: ['#7a4b2c', '#3a2012'], blush: '#ff7f7f',
    gown: ['#fbfcff', '#c4cfe2'], hood: ['#ffffff', '#d3dcec'], hair: ['#4a352b', '#241713'], bg: ['#3a4a73', '#171f36'],
    brow: '#3a2a22', lash: '#25160f', lip: '#b44f4f',
    draw(u, e) {
      const o = this;
      return bgRect(u)
        + `<path d="M5 100 C5 88 18 82 34 80 Q50 92 66 80 C82 82 95 88 95 100Z" fill="url(#${u}gw)"/>`
        + `<path d="M50 88 V100" stroke="#8fa0bd" stroke-width="1.2"/><path d="M30 86 Q40 92 50 90 M70 86 Q60 92 50 90" fill="none" stroke="#9fb0cb" stroke-width="1" opacity=".7"/>`
        + neck(u, o) + headShape(u, o)
        + `<path d="M25 47 C26 33 38 28 50 29 C62 28 74 33 75 47 C70 38 62 36 56 37 Q50 33.5 44 37 C38 36 30 38 25 47Z" fill="url(#${u}hr)"/>`
        + hood(u, o, '#a7b5cf')
        + face(u, e, o)
        + `<path d="M35 81 Q50 90 65 81 Q64 93 50 95 Q36 93 35 81Z" fill="#cfe9f5" stroke="#8fc2dc" stroke-width=".8"/><path d="M39 84 Q50 89 61 84 M40 88 Q50 92 60 88" fill="none" stroke="#8fc2dc" stroke-width=".7"/>`
        + `<path d="M33 83 L44 100 M67 83 L56 100" stroke="#ff9a3c" stroke-width="2.4" stroke-linecap="round"/>`
        + `<rect x="43.5" y="92" width="13" height="9" rx="1.4" fill="#fff" stroke="#c4cfe2"/><rect x="45.5" y="94" width="4" height="3.4" rx=".6" fill="#ff9a3c"/><path d="M51 94.4 h3.6 M51 96.6 h3" stroke="#8fa0bd" stroke-width=".8"/>`
        + `<rect x="74" y="87" width="9" height="13" rx="2" fill="#2b3550"/><rect x="75.6" y="89" width="6" height="3" rx=".8" fill="#6ef0b0"/><path d="M79 87 L81 79" stroke="#2b3550" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  },

  // 製程工程師 阿哲：藍調無塵衣＋透明安全眼鏡、口袋裡插筆、亂翹瀏海、雀斑
  engineer: {
    skin: ['#f6d0ae', '#e2ab82'], shade: '#a8694c', iris: ['#4d3a2a', '#1f140c'], blush: '#ff8a7a',
    gown: ['#e7f0fb', '#aebfdc'], hood: ['#f2f7ff', '#c4d4ec'], hair: ['#3b2d26', '#1b1310'], bg: ['#24506a', '#0f2230'],
    brow: '#2c2018', browW: 2.7, lash: '#1c120c', lip: '#a84e48',
    draw(u, e) {
      const o = this;
      return bgRect(u)
        + `<path d="M5 100 C5 88 18 82 34 80 Q50 92 66 80 C82 82 95 88 95 100Z" fill="url(#${u}gw)"/>`
        + `<path d="M50 88 V100" stroke="#8da3c6" stroke-width="1.2"/>`
        + `<rect x="60" y="88" width="16" height="12" rx="1.6" fill="#d3e0f3" stroke="#8da3c6" stroke-width=".9"/>`
        + `<path d="M63 88 V82 M67 88 V80.5 M71 88 V83" stroke="#2d6fd6" stroke-width="1.6" stroke-linecap="round"/><path d="M67 80.5 v3" stroke="#e24a4a" stroke-width="1.6" stroke-linecap="round"/>`
        + `<rect x="26" y="90" width="12" height="9" rx="1.4" fill="#fff" stroke="#8da3c6"/><rect x="28" y="92" width="3.6" height="3.4" rx=".6" fill="#4aa8ff"/><path d="M33 92.4 h3 M33 94.6 h2.6" stroke="#8da3c6" stroke-width=".8"/>`
        + neck(u, o) + headShape(u, o)
        + `<path d="M25 47 C25 34 36 28 50 29 C64 28 75 34 75 47 C72 40 66 38 62 40 L60 33 L55 39 L50 31 L45 39 L40 34 L38 40 C33 38 28 41 25 47Z" fill="url(#${u}hr)"/>`
        + hood(u, o, '#9bb0d2')
        + `<path d="M32 83 Q50 96 68 83 L72 92 Q50 102 28 92Z" fill="url(#${u}hd)" stroke="#9bb0d2" stroke-width="1"/><path d="M40 88 Q50 94 60 88" fill="none" stroke="#9bb0d2" stroke-width=".8"/>`
        + `<g fill="#c7855f" opacity=".55"><circle cx="31" cy="60" r=".8"/><circle cx="34" cy="63" r=".8"/><circle cx="32.5" cy="65" r=".7"/><circle cx="69" cy="60" r=".8"/><circle cx="66" cy="63" r=".8"/><circle cx="67.5" cy="65" r=".7"/></g>`
        + face(u, e, o)
        // 安全眼鏡
        + `<path d="M22 53 H27 M73 53 H78" stroke="#2d6f8c" stroke-width="2.4" stroke-linecap="round"/>`
        + `<path d="M27 48 Q27 45 31 45 L69 45 Q73 45 73 48 L73 58 Q73 62 69 62 L31 62 Q27 62 27 58Z" fill="#9fe3ff" fill-opacity=".2" stroke="#2d8fb0" stroke-width="2.4"/>`
        + `<path d="M31 46.5 H40 L35 60.5 H29.5Z" fill="#fff" opacity=".28"/><path d="M52 46.5 H57 L52.5 60.5 H48Z" fill="#fff" opacity=".18"/>`
        + `<path d="M47 51 Q50 49.5 53 51" fill="none" stroke="#2d8fb0" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  },

  // 業務 Vivian：深藍西裝外套＋白襯衫、棕色長髮、珍珠耳環（在無塵室外，不穿無塵衣）
  sales: {
    skin: ['#fde3cd', '#f0c3a2'], shade: '#bf7f64', iris: ['#6a3f26', '#2c1810'], blush: '#ff7a8a',
    gown: ['#34456b', '#1d2842'], hood: ['#ffffff', '#ffffff'], hair: ['#8a5636', '#41261a'], bg: ['#5a3f7a', '#231a38'],
    brow: '#4b2f20', lash: '#22120c', lip: '#cc4a62',
    draw(u, e) {
      const o = this;
      return bgRect(u)
        + `<path d="M15 56 C10 22 30 6 50 6 C70 6 90 22 85 56 C87 74 83 90 77 99 L23 99 C17 90 13 74 15 56Z" fill="url(#${u}hr)"/>`
        + `<path d="M4 100 C4 88 18 82 36 80 L64 80 C82 82 96 88 96 100Z" fill="url(#${u}gw)"/>`
        + `<path d="M39 80 L50 100 L61 80Z" fill="#f6f8fc"/><path d="M39 80 L50 93 L47 80Z" fill="#dfe5f0"/>`
        + `<path d="M36 80 L50 100 L36 100 L26 87Z" fill="#2a3a5f" stroke="#4b5f8c" stroke-width=".8"/><path d="M64 80 L50 100 L64 100 L74 87Z" fill="#2a3a5f" stroke="#4b5f8c" stroke-width=".8"/>`
        + `<circle cx="67" cy="91" r="2.1" fill="#ffc933"/><circle cx="66.4" cy="90.4" r=".7" fill="#fff" opacity=".8"/>`
        + neck(u, o)
        + `<path d="M43 80 Q50 88 57 80" fill="none" stroke="#ffc933" stroke-width="1"/><circle cx="50" cy="86.4" r="1.5" fill="#ffc933"/>`
        + headShape(u, o)
        // 前髮：側分、掃向左側
        + `<path d="M20.5 52 C18 24 35 11 52 13 C68 14 81 26 79.5 52 C77 40 71 32 61 30 C55 41 40 41 31 44 C26 46 22.5 49 20.5 52Z" fill="url(#${u}hr)"/>`
        + `<path d="M29 24 Q43 14 60 18" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2.2" stroke-linecap="round"/>`
        + `<path d="M20.5 52 C19 64 22 74 29 79 C26 69 26.5 58 31 47Z" fill="url(#${u}hr)"/><path d="M79.5 52 C81 64 78 74 71 79 C74 69 73.5 58 69 47Z" fill="url(#${u}hr)"/>`
        + face(u, e, o)
        + `<circle cx="21.6" cy="63" r="2" fill="#fff"/><circle cx="21" cy="62.3" r=".7" fill="#dfe5f5"/><circle cx="78.4" cy="63" r="2" fill="#fff"/><circle cx="77.8" cy="62.3" r=".7" fill="#dfe5f5"/>`;
    }
  }
};

export function portraitSvg(npc, expr = 'normal') {
  const c = CHARS[npc] || CHARS.facility;
  if (!EXPRS.includes(expr)) expr = 'normal';
  const u = 'pt' + (++uidN) + '_';
  return `<svg class="npc-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`
    + defs(u, c) + c.draw(u, expr) + `</svg>`;
}
