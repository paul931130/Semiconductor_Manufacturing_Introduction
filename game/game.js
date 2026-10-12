/* 晶圓闖關 Wafer Quest
 * 跟著一片晶圓走完《半導體製造概論》的每一章。
 * Follow one wafer through every chapter of "Introduction to Semiconductor Manufacturing".
 * Content: CC BY-NC-SA 4.0, adapted from the book.
 */
(function () {
  "use strict";

  var BOOK_URL = "https://github.com/chenwei810/Semiconductor_Manufacturing_Introduction/blob/master/";
  var STORE_KEY = "waferQuest.v1";
  // 一關答對幾題 → 這一站的良率。整體良率 = 各站相乘（見第 16 章）。
  // Correct answers in a stage → that station's yield. Overall yield is the product (see chapter 16).
  var STATION_YIELD = [0.80, 0.88, 0.94, 0.98, 1.0];

  var UI = {
    "zh-TW": {
      gameTitle: "晶圓闖關",
      tagline: "跟著一片晶圓，從沙子走到晶片",
      lead: "全書 25 章就是 25 個工作站。每站 4 道關卡，答錯會讓良率下降，各站良率相乘就是最後的整體良率。",
      start: "投片開工",
      continue: "繼續闖關",
      reset: "重新投片",
      resetConfirm: "要清除所有進度，重新開始嗎？",
      lineYield: "累計良率",
      footerBased: "題目內容改編自",
      bookTitle: "《半導體製造概論》",
      partNames: ["開始之前", "基礎", "製程模組", "製程整合", "品質與良率", "後段：測試與封裝", "走出晶圓廠"],
      part: function (n) { return "第 " + n + " 部"; },
      chapter: function (n) { return "第 " + n + " 章"; },
      locked: "尚未解鎖",
      stationYield: "本站良率",
      enter: "進站",
      readChapter: "閱讀本章",
      challenge: function (i, n) { return "關卡 " + i + " / " + n; },
      check: "送出",
      next: "下一題",
      finishStage: "出站",
      correct: "答對了！",
      wrong: "答錯了",
      partly: "部分正確",
      trueLabel: "正確",
      falseLabel: "錯誤",
      orderHint: "依序點選下方項目排出順序，點上方的項目可以取消。",
      matchHint: "先點左邊的名詞，再點右邊的意思來配對。",
      alarm: "⚠ 現場異常",
      waferMapCaption: "晶圓圖：紅色為失效晶粒",
      correctOrder: "正確順序：",
      stageDone: "出站完成",
      stageScore: function (c, n) { return "答對 " + c + " / " + n + " 題"; },
      nextStage: "前往下一站",
      backToMap: "回到路線圖",
      retry: "重做這一站",
      finaleTitle: "恭喜出貨！",
      finaleText: function (y) { return "你的晶圓走完了全部 25 站，整體良率 " + y + "。"; },
      grade: ["再接再厲：這批要開 8D 報告了", "及格：可以出貨，但良率工程師會找你喝咖啡", "優秀：穩定量產的水準", "完美：這片晶圓可以拿去當教材"],
      allDone: "全部完成",
      noData: "找不到這個語言的關卡資料。",
      progress: function (d, n) { return "已完成 " + d + " / " + n + " 站"; },
      dieLegend: "每一格晶粒代表一站：亮起表示已完成"
    },
    en: {
      gameTitle: "Wafer Quest",
      tagline: "Follow one wafer from sand to chip",
      lead: "The book's 25 chapters are 25 stations. Each has 4 challenges; wrong answers cost yield, and the station yields multiply into your overall yield.",
      start: "Start the lot",
      continue: "Continue",
      reset: "Start over",
      resetConfirm: "Clear all progress and start over?",
      lineYield: "Cumulative yield",
      footerBased: "Questions adapted from",
      bookTitle: "Introduction to Semiconductor Manufacturing",
      partNames: ["Before You Start", "Fundamentals", "Process Modules", "Process Integration", "Quality and Yield", "Back End: Test and Packaging", "Beyond the Fab"],
      part: function (n) { return "Part " + n; },
      chapter: function (n) { return "Chapter " + n; },
      locked: "Locked",
      stationYield: "Station yield",
      enter: "Enter",
      readChapter: "Read the chapter",
      challenge: function (i, n) { return "Challenge " + i + " / " + n; },
      check: "Submit",
      next: "Next",
      finishStage: "Leave station",
      correct: "Correct!",
      wrong: "Not quite",
      partly: "Partly right",
      trueLabel: "True",
      falseLabel: "False",
      orderHint: "Tap the items below in order. Tap an item above to take it back.",
      matchHint: "Tap a term on the left, then its meaning on the right.",
      alarm: "⚠ Floor incident",
      waferMapCaption: "Wafer map: red dies failed",
      correctOrder: "Correct order:",
      stageDone: "Station complete",
      stageScore: function (c, n) { return c + " / " + n + " correct"; },
      nextStage: "Next station",
      backToMap: "Back to route",
      retry: "Redo this station",
      finaleTitle: "Shipped!",
      finaleText: function (y) { return "Your wafer made it through all 25 stations with an overall yield of " + y + "."; },
      grade: ["Keep going: this lot needs an 8D report", "Pass: it ships, but the yield engineer wants a word", "Great: ready for volume production", "Perfect: this wafer goes in the textbook"],
      allDone: "All done",
      noData: "No level data for this language.",
      progress: function (d, n) { return d + " / " + n + " stations done"; },
      dieLegend: "Each die is one station; lit dies are done"
    }
  };

  var registry = {};
  var state = load();
  var app;
  var keyHandler = null;

  // ---------- storage ----------
  function load() {
    var s = { lang: null, best: {} };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          s.lang = parsed.lang || null;
          s.best = parsed.best || {};
        }
      }
    } catch (e) { /* 無痕模式等情況下 storage 可能無法使用 / storage may be unavailable */ }
    if (!s.lang) {
      var nav = (navigator.language || "").toLowerCase();
      s.lang = nav.indexOf("zh") === 0 ? "zh-TW" : "en";
    }
    return s;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  // ---------- helpers ----------
  function t(key) { return UI[state.lang][key]; }
  function stages() {
    return (registry[state.lang] || []).slice().sort(function (a, b) { return a.chapter - b.chapter; });
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  function shuffle(arr, avoidIdentity) {
    var a = arr.slice();
    for (var tries = 0; tries < 10; tries++) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      if (!avoidIdentity || a.length < 2 || a.some(function (x, k) { return x !== arr[k]; })) break;
    }
    return a;
  }
  function pct(x) { return (Math.round(x * 1000) / 10).toFixed(1) + "%"; }
  function overallYield() {
    var y = 1;
    Object.keys(state.best).forEach(function (ch) {
      y *= STATION_YIELD[state.best[ch]] || 1;
    });
    return y;
  }
  function isDone(ch) { return Object.prototype.hasOwnProperty.call(state.best, ch); }
  function isUnlocked(list, idx) { return idx === 0 || isDone(list[idx - 1].chapter); }
  function setKeys(fn) { keyHandler = fn; }
  function render(node) {
    setKeys(null);
    app.textContent = "";
    app.appendChild(node);
    window.scrollTo(0, 0);
    updateChrome();
    var focusTarget = app.querySelector("[data-autofocus]") || app.querySelector("h1, h2");
    if (focusTarget) { focusTarget.setAttribute("tabindex", "-1"); focusTarget.focus({ preventScroll: true }); }
  }
  function updateChrome() {
    document.documentElement.lang = state.lang;
    document.title = UI[state.lang].gameTitle + (state.lang === "en" ? " · 晶圓闖關" : " · Wafer Quest");
    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      var v = t(n.getAttribute("data-i18n"));
      if (typeof v === "string") n.textContent = v;
    });
    document.getElementById("lang-btn").textContent = state.lang === "en" ? "中文" : "EN";
    var chip = document.getElementById("yield-chip");
    chip.hidden = Object.keys(state.best).length === 0;
    document.getElementById("yield-value").textContent = pct(overallYield());
  }

  // ---------- wafer drawing ----------
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function dieGrid(n) {
    // n x n 格子中，落在圓內的晶粒 / dies of an n×n grid that sit inside the circle
    var dies = [];
    var c = (n - 1) / 2, r = n / 2;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var dx = x - c, dy = y - c;
        var cornerDist = Math.sqrt(Math.pow(Math.abs(dx) + 0.5, 2) + Math.pow(Math.abs(dy) + 0.5, 2));
        if (cornerDist <= r + 0.05) dies.push({ x: x, y: y, dx: dx, dy: dy, d: Math.sqrt(dx * dx + dy * dy) / r });
      }
    }
    return dies;
  }
  function seeded(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }
  function failPattern(pattern, die, rnd) {
    switch (pattern) {
      case "center": return die.d < 0.38 ? rnd() < 0.85 : rnd() < 0.03;
      case "edge": return die.d > 0.78 ? rnd() < 0.8 : rnd() < 0.03;
      case "scratch": return Math.abs(die.dy - 0.55 * die.dx - 0.8) < 0.75 && die.dx > -4.5 && die.dx < 4.2 || rnd() < 0.02;
      case "cluster": return Math.pow(die.dx - 2.2, 2) + Math.pow(die.dy + 2, 2) < 4.2 ? rnd() < 0.9 : rnd() < 0.03;
      case "half": return die.dx > 0.3 ? rnd() < 0.75 : rnd() < 0.03;
      default: return rnd() < 0.12;
    }
  }
  function waferMap(pattern) {
    var n = 13, cell = 20, pad = 12, size = n * cell + pad * 2;
    var root = svg("svg", { viewBox: "0 0 " + size + " " + size, class: "wafermap", role: "img", "aria-label": t("waferMapCaption") });
    var half = size / 2;
    root.appendChild(svg("circle", { cx: half, cy: half, r: n * cell / 2 + 6, class: "wafer-disc" }));
    root.appendChild(svg("path", { d: "M" + (half - 9) + " " + (size - 4) + " L" + half + " " + (size - 13) + " L" + (half + 9) + " " + (size - 4) + " Z", class: "wafer-notch" }));
    var rnd = seeded(pattern.length * 977 + 31);
    dieGrid(n).forEach(function (die) {
      var bad = failPattern(pattern, die, rnd);
      root.appendChild(svg("rect", {
        x: pad + die.x * cell + 1.5, y: pad + die.y * cell + 1.5, width: cell - 3, height: cell - 3, rx: 2,
        class: bad ? "die die-bad" : "die die-good"
      }));
    });
    return root;
  }
  function progressWafer(list) {
    // 用晶圓上的晶粒代表各站進度 / one die per station
    var n = 7, cell = 26, pad = 14, size = n * cell + pad * 2;
    var root = svg("svg", { viewBox: "0 0 " + size + " " + size, class: "progress-wafer", "aria-hidden": "true" });
    var half = size / 2;
    root.appendChild(svg("circle", { cx: half, cy: half, r: n * cell / 2 + 8, class: "wafer-disc" }));
    var dies = dieGrid(n);
    dies.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var offset = Math.max(0, Math.floor((dies.length - list.length) / 2));
    dies.forEach(function (die, i) {
      var stage = list[i - offset];
      var cls = "die die-idle";
      if (stage && isDone(stage.chapter)) cls = state.best[stage.chapter] === 4 ? "die die-gold" : "die die-lit";
      root.appendChild(svg("rect", { x: pad + die.x * cell + 2, y: pad + die.y * cell + 2, width: cell - 4, height: cell - 4, rx: 3, class: cls }));
    });
    return root;
  }

  // ---------- screens ----------
  function screenTitle() {
    var list = stages();
    var done = list.filter(function (s) { return isDone(s.chapter); }).length;
    var hasProgress = done > 0;
    var actions = el("div", { class: "actions" }, [
      el("button", { class: "btn primary", type: "button", "data-autofocus": true, text: hasProgress ? t("continue") : t("start"), onclick: screenMap })
    ]);
    if (hasProgress) {
      actions.appendChild(el("button", {
        class: "btn ghost", type: "button", text: t("reset"),
        onclick: function () { if (window.confirm(t("resetConfirm"))) { state.best = {}; save(); screenTitle(); } }
      }));
    }
    render(el("section", { class: "title-screen" }, [
      progressWafer(list),
      el("h1", { text: t("gameTitle") }),
      el("p", { class: "tagline", text: t("tagline") }),
      el("p", { class: "lead", text: t("lead") }),
      hasProgress ? el("p", { class: "muted", text: t("progress")(done, list.length) }) : null,
      actions
    ]));
    setKeys(function (e) { if (e.key === "Enter") screenMap(); });
  }

  function screenMap() {
    var list = stages();
    if (!list.length) { render(el("p", { class: "lead", text: t("noData") })); return; }
    var wrap = el("section", { class: "map-screen" }, [
      el("div", { class: "map-head" }, [
        el("h1", { text: t("gameTitle") }),
        el("p", { class: "muted", text: t("progress")(list.filter(function (s) { return isDone(s.chapter); }).length, list.length) })
      ])
    ]);
    var firstOpen = null;
    var parts = {};
    list.forEach(function (s, idx) {
      if (!parts[s.part]) {
        parts[s.part] = el("ol", { class: "stations" });
        wrap.appendChild(el("h2", { class: "part-title" }, [
          el("span", { class: "part-num", text: t("part")(s.part) }),
          " " + (t("partNames")[s.part] || "")
        ]));
        wrap.appendChild(parts[s.part]);
      }
      var unlocked = isUnlocked(list, idx);
      var done = isDone(s.chapter);
      if (unlocked && !done && firstOpen === null) firstOpen = idx;
      var badge = done ? el("span", { class: "stars", "aria-label": state.best[s.chapter] + "/4" }, [stars(state.best[s.chapter])])
        : el("span", { class: "badge", text: unlocked ? t("enter") : "🔒" });
      parts[s.part].appendChild(el("li", {}, [
        el("button", {
          class: "station" + (done ? " done" : "") + (unlocked ? "" : " locked") + (unlocked && !done ? " current" : ""),
          type: "button", disabled: !unlocked, "aria-label": t("chapter")(s.chapter) + " " + s.title + (unlocked ? "" : " — " + t("locked")),
          "data-autofocus": unlocked && !done && firstOpen === idx ? true : null,
          onclick: function () { screenIntro(idx); }
        }, [
          el("span", { class: "ch-num", text: String(s.chapter) }),
          el("span", { class: "station-text" }, [
            el("span", { class: "station-title", text: s.title }),
            el("span", { class: "station-sub", text: s.station })
          ]),
          badge
        ])
      ]));
    });
    if (list.every(function (s) { return isDone(s.chapter); })) {
      wrap.appendChild(el("div", { class: "actions" }, [
        el("button", { class: "btn primary", type: "button", text: t("allDone") + " →", onclick: screenFinale })
      ]));
    }
    render(wrap);
  }

  function stars(n) {
    var s = "";
    var lit = n === 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0;
    for (var i = 0; i < 3; i++) s += i < lit ? "★" : "☆";
    return s;
  }

  function chapterLink(stage) {
    return el("a", { class: "chapter-link", href: BOOK_URL + stage.path, target: "_blank", rel: "noopener", text: "📖 " + t("readChapter") + " ↗" });
  }

  function screenIntro(idx) {
    var s = stages()[idx];
    render(el("section", { class: "intro-screen card" }, [
      el("p", { class: "eyebrow", text: t("part")(s.part) + " · " + t("chapter")(s.chapter) }),
      el("h1", { text: s.title }),
      el("p", { class: "station-pill", text: "📍 " + s.station }),
      el("p", { class: "lead", text: s.intro }),
      el("div", { class: "actions" }, [
        el("button", { class: "btn primary", type: "button", "data-autofocus": true, text: t("enter"), onclick: function () { runStage(idx); } }),
        chapterLink(s)
      ])
    ]));
    setKeys(function (e) { if (e.key === "Enter") runStage(idx); });
  }

  function runStage(idx) {
    var s = stages()[idx];
    var results = [];
    function show(i) {
      if (i >= s.challenges.length) { screenResult(idx, results); return; }
      var c = s.challenges[i];
      var body = el("div", { class: "challenge-body" });
      var feedback = el("div", { class: "feedback", hidden: true });
      var card = el("section", { class: "challenge card" + (c.alarm ? " alarm" : "") }, [
        el("div", { class: "challenge-head" }, [
          el("span", { class: "eyebrow", text: t("chapter")(s.chapter) + " · " + s.title }),
          el("span", { class: "pips" }, s.challenges.map(function (_, k) {
            return el("span", { class: "pip" + (k < i ? (results[k] ? " ok" : " ng") : k === i ? " now" : "") });
          }))
        ]),
        el("p", { class: "muted small", text: t("challenge")(i + 1, s.challenges.length) }),
        c.alarm ? el("p", { class: "alarm-tag", text: t("alarm") }) : null,
        el("h2", { class: "question", text: c.q }),
        body,
        feedback
      ]);
      render(card);
      var finish = function (ok, partial, extra) {
        results[i] = ok;
        feedback.hidden = false;
        feedback.className = "feedback " + (ok ? "ok" : "ng");
        var isLast = i + 1 >= s.challenges.length;
        var nextBtn = el("button", {
          class: "btn primary", type: "button", text: isLast ? t("finishStage") : t("next"),
          onclick: function () { show(i + 1); }
        });
        feedback.appendChild(el("p", { class: "verdict", text: ok ? t("correct") : partial ? t("partly") : t("wrong") }));
        if (extra) feedback.appendChild(extra);
        feedback.appendChild(el("p", { class: "explain", text: c.explain }));
        feedback.appendChild(el("div", { class: "actions" }, [nextBtn]));
        nextBtn.focus({ preventScroll: true });
        feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setKeys(function (e) { if (e.key === "Enter") { e.preventDefault(); show(i + 1); } });
      };
      var renderer = { quiz: renderChoice, wafermap: renderChoice, truefalse: renderTrueFalse, order: renderOrder, match: renderMatch }[c.type];
      (renderer || renderChoice)(c, body, finish);
    }
    show(0);
  }

  function renderChoice(c, body, finish) {
    if (c.type === "wafermap") {
      body.appendChild(el("figure", { class: "map-figure" }, [waferMap(c.pattern), el("figcaption", { class: "muted small", text: t("waferMapCaption") })]));
    }
    var buttons = [];
    var list = el("div", { class: "options" });
    var answered = false;
    // 每次打亂選項順序，避免背位置 / shuffle so players can't memorise positions
    var order = shuffle(c.options.map(function (_, k) { return k; }));
    var answer = order.indexOf(c.answer);
    function pick(k) {
      if (answered) return;
      answered = true;
      buttons.forEach(function (b, j) {
        b.disabled = true;
        if (j === answer) b.classList.add("right");
        else if (j === k) b.classList.add("picked-wrong");
      });
      finish(k === answer);
    }
    order.forEach(function (orig, k) {
      var opt = c.options[orig];
      var b = el("button", { class: "option", type: "button", onclick: function () { pick(k); } }, [
        el("span", { class: "key", text: String.fromCharCode(65 + k) }), el("span", { text: opt })
      ]);
      buttons.push(b);
      list.appendChild(b);
    });
    body.appendChild(list);
    setKeys(function (e) {
      var k = "1234".indexOf(e.key);
      if (k < 0) k = "abcd".indexOf(e.key.toLowerCase());
      if (k >= 0 && k < c.options.length) pick(k);
    });
  }

  function renderTrueFalse(c, body, finish) {
    var answered = false;
    var yes, no;
    function pick(v) {
      if (answered) return;
      answered = true;
      yes.disabled = no.disabled = true;
      (c.answer ? yes : no).classList.add("right");
      if (v !== c.answer) (v ? yes : no).classList.add("picked-wrong");
      finish(v === c.answer);
    }
    yes = el("button", { class: "option tf", type: "button", onclick: function () { pick(true); } }, [el("span", { class: "key", text: "O" }), el("span", { text: t("trueLabel") })]);
    no = el("button", { class: "option tf", type: "button", onclick: function () { pick(false); } }, [el("span", { class: "key", text: "X" }), el("span", { text: t("falseLabel") })]);
    body.appendChild(el("div", { class: "options tf-row" }, [yes, no]));
    setKeys(function (e) {
      var k = e.key.toLowerCase();
      if (k === "o" || k === "t" || k === "1") pick(true);
      if (k === "x" || k === "f" || k === "2") pick(false);
    });
  }

  function renderOrder(c, body, finish) {
    var pool = shuffle(c.items.map(function (_, k) { return k; }), true);
    var chosen = [];
    var slots = el("ol", { class: "order-slots" });
    var poolBox = el("div", { class: "order-pool" });
    var submit = el("button", { class: "btn primary", type: "button", text: t("check"), disabled: true });
    var locked = false;
    function draw() {
      slots.textContent = "";
      for (var k = 0; k < c.items.length; k++) {
        var idx = chosen[k];
        slots.appendChild(el("li", { class: "slot" + (idx == null ? " empty" : "") }, [
          idx == null ? el("span", { class: "muted", text: "…" }) : el("button", {
            type: "button", class: "chip", text: c.items[idx], disabled: locked,
            onclick: (function (pos) { return function () { chosen.splice(pos, 1); draw(); }; })(k)
          })
        ]));
      }
      poolBox.textContent = "";
      pool.forEach(function (idx) {
        if (chosen.indexOf(idx) >= 0) return;
        poolBox.appendChild(el("button", { type: "button", class: "chip", text: c.items[idx], disabled: locked, onclick: function () { chosen.push(idx); draw(); } }));
      });
      submit.disabled = locked || chosen.length !== c.items.length;
    }
    submit.addEventListener("click", function () {
      if (locked) return;
      locked = true;
      var right = 0;
      Array.prototype.forEach.call(slots.children, function (li, k) {
        var ok = chosen[k] === k;
        if (ok) right++;
        li.classList.add(ok ? "right" : "picked-wrong");
      });
      draw();
      Array.prototype.forEach.call(slots.children, function (li, k) {
        li.classList.add(chosen[k] === k ? "right" : "picked-wrong");
      });
      var all = right === c.items.length;
      var extra = all ? null : el("div", {}, [
        el("p", { class: "small", text: t("correctOrder") }),
        el("ol", { class: "answer-list" }, c.items.map(function (it) { return el("li", { text: it }); }))
      ]);
      submit.hidden = true;
      finish(all, right > 0, extra);
    });
    body.appendChild(el("p", { class: "muted small", text: t("orderHint") }));
    body.appendChild(slots);
    body.appendChild(poolBox);
    body.appendChild(el("div", { class: "actions" }, [submit]));
    draw();
  }

  function renderMatch(c, body, finish) {
    var n = c.pairs.length;
    var rightOrder = shuffle(c.pairs.map(function (_, k) { return k; }), true);
    var link = {}; // term index -> meaning index
    var activeTerm = null;
    var locked = false;
    var termBtns = [], meanBtns = [];
    var submit = el("button", { class: "btn primary", type: "button", text: t("check"), disabled: true });
    var left = el("div", { class: "match-col" });
    var right = el("div", { class: "match-col" });
    function termOf(m) {
      for (var k in link) if (link[k] === m) return +k;
      return null;
    }
    function paint() {
      termBtns.forEach(function (b, k) {
        b.className = "match-item" + (activeTerm === k ? " active" : "") + (link[k] != null ? " paired c" + k : "");
        b.disabled = locked;
      });
      meanBtns.forEach(function (b) {
        var m = +b.getAttribute("data-m");
        var tk = termOf(m);
        b.className = "match-item" + (tk != null ? " paired c" + tk : "");
        b.disabled = locked;
      });
      submit.disabled = locked || Object.keys(link).length !== n;
    }
    c.pairs.forEach(function (p, k) {
      var b = el("button", { type: "button", class: "match-item", text: p[0], onclick: function () {
        if (link[k] != null) delete link[k];
        activeTerm = k;
        paint();
      } });
      termBtns.push(b);
      left.appendChild(b);
    });
    rightOrder.forEach(function (m) {
      var b = el("button", { type: "button", class: "match-item", "data-m": m, text: c.pairs[m][1], onclick: function () {
        var tk = termOf(m);
        if (activeTerm == null) { if (tk != null) { delete link[tk]; paint(); } return; }
        if (tk != null) delete link[tk];
        link[activeTerm] = m;
        var nextFree = null;
        for (var j = 0; j < n; j++) if (link[j] == null) { nextFree = j; break; }
        activeTerm = nextFree;
        paint();
      } });
      meanBtns.push(b);
      right.appendChild(b);
    });
    activeTerm = 0;
    submit.addEventListener("click", function () {
      if (locked) return;
      locked = true;
      var good = 0;
      for (var k = 0; k < n; k++) if (link[k] === k) good++;
      paint();
      termBtns.forEach(function (b, k) { b.classList.add(link[k] === k ? "right" : "picked-wrong"); });
      var all = good === n;
      var extra = all ? null : el("ul", { class: "answer-list" }, c.pairs.map(function (p) {
        return el("li", {}, [el("strong", { text: p[0] }), " — " + p[1]]);
      }));
      submit.hidden = true;
      finish(all, good > 0, extra);
    });
    body.appendChild(el("p", { class: "muted small", text: t("matchHint") }));
    body.appendChild(el("div", { class: "match-grid" }, [left, right]));
    body.appendChild(el("div", { class: "actions" }, [submit]));
    paint();
  }

  function screenResult(idx, results) {
    var list = stages();
    var s = list[idx];
    var correct = results.filter(Boolean).length;
    var prev = state.best[s.chapter];
    if (prev == null || correct > prev) state.best[s.chapter] = correct;
    save();
    var last = idx + 1 >= list.length;
    var goNext = function () { if (last) screenFinale(); else screenIntro(idx + 1); };
    render(el("section", { class: "result-screen card" }, [
      el("p", { class: "eyebrow", text: t("chapter")(s.chapter) + " · " + s.title }),
      el("h1", { text: t("stageDone") }),
      el("p", { class: "big-stars", text: stars(correct) }),
      el("p", { class: "lead", text: t("stageScore")(correct, results.length) }),
      el("dl", { class: "stats" }, [
        el("div", {}, [el("dt", { text: t("stationYield") }), el("dd", { text: pct(STATION_YIELD[correct]) })]),
        el("div", {}, [el("dt", { text: t("lineYield") }), el("dd", { text: pct(overallYield()) })])
      ]),
      el("div", { class: "actions" }, [
        el("button", { class: "btn primary", type: "button", "data-autofocus": true, text: last ? t("allDone") + " →" : t("nextStage") + " →", onclick: goNext }),
        el("button", { class: "btn ghost", type: "button", text: t("retry"), onclick: function () { runStage(idx); } }),
        el("button", { class: "btn ghost", type: "button", text: t("backToMap"), onclick: screenMap }),
        chapterLink(s)
      ])
    ]));
    setKeys(function (e) { if (e.key === "Enter") goNext(); });
  }

  function screenFinale() {
    var list = stages();
    var y = overallYield();
    var grade = y >= 0.999 ? 3 : y >= 0.75 ? 2 : y >= 0.4 ? 1 : 0;
    render(el("section", { class: "title-screen" }, [
      progressWafer(list),
      el("h1", { text: t("finaleTitle") }),
      el("p", { class: "lead", text: t("finaleText")(pct(y)) }),
      el("p", { class: "grade", text: t("grade")[grade] }),
      el("div", { class: "actions" }, [
        el("button", { class: "btn primary", type: "button", "data-autofocus": true, text: t("backToMap"), onclick: screenMap }),
        el("button", { class: "btn ghost", type: "button", text: t("reset"), onclick: function () { if (window.confirm(t("resetConfirm"))) { state.best = {}; save(); screenTitle(); } } })
      ])
    ]));
  }

  // ---------- public ----------
  window.WaferQuest = {
    register: function (lang, list) {
      registry[lang] = (registry[lang] || []).concat(list);
    },
    start: function () {
      app = document.getElementById("app");
      if (!UI[state.lang]) state.lang = "zh-TW";
      document.getElementById("home-btn").addEventListener("click", screenTitle);
      document.getElementById("lang-btn").addEventListener("click", function () {
        state.lang = state.lang === "en" ? "zh-TW" : "en";
        save();
        screenTitle();
      });
      document.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var tag = (e.target && e.target.tagName) || "";
        if (e.key === "Enter" && tag === "BUTTON") return; // 讓按鈕自己處理 / let the focused button handle it
        if (keyHandler) keyHandler(e);
      });
      screenTitle();
    }
  };
})();
