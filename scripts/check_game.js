#!/usr/bin/env node
'use strict';

// Validates WaferQuest level data under game/data/{zh-TW,en}/*.js.
// Usage (from repo root): node scripts/check_game.js
// Exit code: 0 when no errors, 1 otherwise.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LANGS = ['zh-TW', 'en'];
const REFERENCE_LANG = 'zh-TW';
const CHAPTER_MIN = 0;
const CHAPTER_MAX = 24;
const STAGE_CHALLENGE_COUNT = 4;
const CHALLENGE_TYPES = ['quiz', 'truefalse', 'order', 'match', 'wafermap'];
const WAFER_PATTERNS = ['center', 'edge', 'scratch', 'cluster', 'random', 'half'];

const errors = [];
const stagesByLang = {};
for (const lang of LANGS) stagesByLang[lang] = [];
let currentFile = null;
let loadedFileCount = 0;

function rel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStringArrayUnique(arr) {
  return new Set(arr).size === arr.length;
}

// Global hook used by the level data files.
global.WaferQuest = {
  register(lang, stages) {
    const where = currentFile || '(unknown file)';
    if (!LANGS.includes(lang)) {
      errors.push(`[${where}] register: unknown lang ${JSON.stringify(lang)}`);
      return;
    }
    if (!Array.isArray(stages)) {
      errors.push(`[${where}] register(${lang}): stages must be an array`);
      return;
    }
    for (const stage of stages) stagesByLang[lang].push({ stage, file: where });
  },
};

// Load every .js file in each language directory.
for (const lang of LANGS) {
  const dir = path.join(REPO_ROOT, 'game', 'data', lang);
  let names;
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  } catch (e) {
    errors.push(`[${lang}] cannot read data directory ${rel(dir)} (${e.code || e.message})`);
    continue;
  }
  for (const name of names) {
    const file = path.join(dir, name);
    currentFile = rel(file);
    try {
      require(file);
      loadedFileCount++;
    } catch (e) {
      const msg = e && e.message ? e.message.split('\n')[0] : String(e);
      errors.push(`[parse] ${currentFile}: ${msg}`);
    }
  }
}
currentFile = null;

// Validate a single challenge. `err(message)` reports against the challenge index.
function checkChallenge(c, err) {
  if (!isObject(c)) {
    err('challenge must be an object');
    return;
  }
  if (!CHALLENGE_TYPES.includes(c.type)) {
    err(`invalid type ${JSON.stringify(c.type)} (expected one of ${CHALLENGE_TYPES.join(', ')})`);
    return;
  }
  if (!isNonEmptyString(c.q)) err('q must be a non-empty string');
  if (!isNonEmptyString(c.explain)) err('explain must be a non-empty string');

  switch (c.type) {
    case 'quiz':
    case 'wafermap': {
      const opts = c.options;
      if (!Array.isArray(opts)) {
        err('options must be an array');
      } else if (opts.length < 3 || opts.length > 4) {
        err(`options must have 3-4 entries (has ${opts.length})`);
      } else if (!opts.every(isNonEmptyString)) {
        err('every option must be a non-empty string');
      }
      if (!Number.isInteger(c.answer)) {
        err('answer must be an integer');
      } else if (Array.isArray(opts) && (c.answer < 0 || c.answer >= opts.length)) {
        err(`answer ${c.answer} out of range 0..${opts.length - 1}`);
      } else if (!Array.isArray(opts) && c.answer < 0) {
        err(`answer ${c.answer} must be >= 0`);
      }
      if (c.type === 'wafermap' && !WAFER_PATTERNS.includes(c.pattern)) {
        err(`pattern ${JSON.stringify(c.pattern)} not in ${WAFER_PATTERNS.join('/')}`);
      }
      break;
    }
    case 'truefalse':
      if (typeof c.answer !== 'boolean') err('answer must be a boolean');
      break;
    case 'order':
      if (!Array.isArray(c.items)) {
        err('items must be an array');
      } else if (c.items.length < 3 || c.items.length > 6) {
        err(`items must have 3-6 entries (has ${c.items.length})`);
      } else if (!c.items.every(isNonEmptyString)) {
        err('every item must be a non-empty string');
      } else if (!isStringArrayUnique(c.items)) {
        err('items must be unique');
      }
      break;
    case 'match':
      if (!Array.isArray(c.pairs)) {
        err('pairs must be an array');
      } else if (c.pairs.length < 3 || c.pairs.length > 4) {
        err(`pairs must have 3-4 entries (has ${c.pairs.length})`);
      } else {
        let pairsOk = true;
        for (const p of c.pairs) {
          if (!Array.isArray(p) || p.length !== 2 || !p.every(isNonEmptyString)) {
            pairsOk = false;
            break;
          }
        }
        if (!pairsOk) {
          err('every pair must be a two-element array of non-empty strings');
        } else if (!isStringArrayUnique(c.pairs.map((p) => p[0]))) {
          err('pair terms (first element) must be unique');
        }
      }
      break;
  }
}

// Validate a stage. Returns nothing; reports via errors[].
function checkStage(lang, stage) {
  const label = isObject(stage) ? String(stage.chapter) : '?';
  const stageErr = (msg) => errors.push(`[${lang} ch ${label} #-] ${msg}`);
  const chErr = (i) => (msg) => errors.push(`[${lang} ch ${label} #${i}] ${msg}`);

  if (!isObject(stage)) {
    stageErr('stage must be an object');
    return;
  }
  if (!Number.isInteger(stage.chapter)) {
    stageErr('chapter must be an integer');
  } else if (stage.chapter < CHAPTER_MIN || stage.chapter > CHAPTER_MAX) {
    stageErr(`chapter ${stage.chapter} out of range ${CHAPTER_MIN}..${CHAPTER_MAX}`);
  }
  if (!Number.isInteger(stage.part)) stageErr('part must be an integer');
  for (const key of ['title', 'station', 'intro', 'path']) {
    if (!isNonEmptyString(stage[key])) stageErr(`${key} must be a non-empty string`);
  }
  if (isNonEmptyString(stage.path)) {
    if (!stage.path.startsWith(lang + '/')) {
      stageErr(`path must start with "${lang}/" (got ${JSON.stringify(stage.path)})`);
    }
    const abs = path.resolve(REPO_ROOT, stage.path);
    let isFile = false;
    try {
      isFile = fs.statSync(abs).isFile();
    } catch (e) {
      isFile = false;
    }
    if (!isFile) stageErr(`path file not found: ${stage.path}`);
  }
  if (!Array.isArray(stage.challenges)) {
    stageErr('challenges must be an array');
    return;
  }
  if (stage.challenges.length !== STAGE_CHALLENGE_COUNT) {
    stageErr(`challenges must have exactly ${STAGE_CHALLENGE_COUNT} entries (has ${stage.challenges.length})`);
  }
  stage.challenges.forEach((c, i) => checkChallenge(c, chErr(i)));
}

// Per-stage validation.
for (const lang of LANGS) {
  for (const { stage } of stagesByLang[lang]) checkStage(lang, stage);
}

// Group valid-chapter stages by language and chapter.
const byLangChapter = {};
for (const lang of LANGS) {
  byLangChapter[lang] = {};
  for (const { stage } of stagesByLang[lang]) {
    if (!isObject(stage) || !Number.isInteger(stage.chapter)) continue;
    if (stage.chapter < CHAPTER_MIN || stage.chapter > CHAPTER_MAX) continue;
    (byLangChapter[lang][stage.chapter] = byLangChapter[lang][stage.chapter] || []).push(stage);
  }
}

// Each chapter 0..24 must appear exactly once per language.
for (const lang of LANGS) {
  for (let ch = CHAPTER_MIN; ch <= CHAPTER_MAX; ch++) {
    const list = byLangChapter[lang][ch] || [];
    if (list.length === 0) errors.push(`[${lang} ch ${ch} #-] missing chapter`);
    else if (list.length > 1) errors.push(`[${lang} ch ${ch} #-] duplicate chapter (appears ${list.length} times)`);
  }
}

// Parity between languages, chapter by chapter (uses the first stage for each).
const otherLang = LANGS.find((l) => l !== REFERENCE_LANG);
for (let ch = CHAPTER_MIN; ch <= CHAPTER_MAX; ch++) {
  const refList = byLangChapter[REFERENCE_LANG][ch] || [];
  const othList = byLangChapter[otherLang][ch] || [];
  if (refList.length === 0 || othList.length === 0) continue;
  const a = refList[0];
  const b = othList[0];
  const pErr = (i, msg) => errors.push(`[${otherLang} ch ${ch} #${i}] parity: ${msg}`);

  if (a.part !== b.part) {
    pErr('-', `part ${REFERENCE_LANG}=${a.part} ${otherLang}=${b.part}`);
  }
  if (!Array.isArray(a.challenges) || !Array.isArray(b.challenges)) continue;
  if (a.challenges.length !== b.challenges.length) {
    pErr('-', `challenge count ${REFERENCE_LANG}=${a.challenges.length} ${otherLang}=${b.challenges.length}`);
  }
  const n = Math.min(a.challenges.length, b.challenges.length);
  for (let i = 0; i < n; i++) {
    const ca = a.challenges[i];
    const cb = b.challenges[i];
    if (!isObject(ca) || !isObject(cb)) continue;
    if (ca.type !== cb.type) {
      pErr(i, `type ${REFERENCE_LANG}=${ca.type} ${otherLang}=${cb.type}`);
      continue;
    }
    switch (ca.type) {
      case 'quiz':
      case 'wafermap':
        if (ca.answer !== cb.answer) {
          pErr(i, `answer index ${REFERENCE_LANG}=${ca.answer} ${otherLang}=${cb.answer}`);
        }
        if (ca.type === 'wafermap' && ca.pattern !== cb.pattern) {
          pErr(i, `pattern ${REFERENCE_LANG}=${ca.pattern} ${otherLang}=${cb.pattern}`);
        }
        break;
      case 'truefalse':
        if (ca.answer !== cb.answer) {
          pErr(i, `answer ${REFERENCE_LANG}=${ca.answer} ${otherLang}=${cb.answer}`);
        }
        break;
      case 'order': {
        const na = Array.isArray(ca.items) ? ca.items.length : 'n/a';
        const nb = Array.isArray(cb.items) ? cb.items.length : 'n/a';
        if (na !== nb) pErr(i, `order item count ${REFERENCE_LANG}=${na} ${otherLang}=${nb}`);
        break;
      }
      case 'match': {
        const na = Array.isArray(ca.pairs) ? ca.pairs.length : 'n/a';
        const nb = Array.isArray(cb.pairs) ? cb.pairs.length : 'n/a';
        if (na !== nb) pErr(i, `match pair count ${REFERENCE_LANG}=${na} ${otherLang}=${nb}`);
        break;
      }
    }
  }
}

for (const e of errors) console.log(e);

const stageCounts = LANGS.map((l) => `${l}: ${stagesByLang[l].length}`).join(', ');
console.log(
  `Summary: ${errors.length} error(s); ${loadedFileCount} file(s) loaded; stages ${stageCounts}`
);

process.exitCode = errors.length > 0 ? 1 : 0;
