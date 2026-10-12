// Wafer Quest level data — Part 0 (zh-TW). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("zh-TW", [
  {
    chapter: 0,
    part: 0,
    title: "半導體製造全景",
    station: "出發點",
    intro: "一片全新的空白晶圓靜靜躺在晶圓盒裡，即將踏上數百個步驟、長達數月的旅程。先看看地圖，你就知道它要去哪裡。",
    path: "zh-TW/0-before-you-start/00-overview/README.md",
    challenges: [
      {
        type: "order",
        q: "把晶片旅程的階段排成正確順序",
        items: ["設計", "光罩製作", "投片", "前段製程", "晶圓測試", "封裝"],
        explain: "旅程地圖是：設計 → 光罩製作 → 投片 → 前段製程 → 晶圓測試 → 封裝 → 最終測試 → 出貨。"
      },
      {
        type: "match",
        q: "把晶圓廠的三個基本單位配對到意思",
        pairs: [
          ["Lot（批）", "一起移動、生產的一組晶圓"],
          ["Route（流程）", "產品從頭到尾的所有步驟與順序"],
          ["Recipe（配方）", "某步驟在機台上用的參數"]
        ],
        explain: "Lot 像一盒雞蛋，Route 像食譜的步驟清單，Recipe 像烤箱的溫度與時間設定。"
      },
      {
        type: "quiz",
        q: "晶圓代工廠（Foundry）和 IDM 最大的差別是什麼？",
        options: [
          "代工廠沒有晶圓廠",
          "IDM 只做封裝與測試",
          "代工廠替別人製造晶片，IDM 主要製造自己設計的產品",
          "代工廠自己設計、自己銷售晶片"
        ],
        answer: 2,
        explain: "兩者都有晶圓廠，差別在於 IDM 主要做自己設計的產品，代工廠則替客戶製造。"
      },
      {
        type: "truefalse",
        q: "市場需求突然暴增時，只要立刻投片，晶片很快就能出貨。",
        answer: false,
        explain: "一片晶圓從投片到出貨，前段加後段往往要三、四個月以上，所以供貨無法馬上恢復。"
      }
    ]
  },
  {
    chapter: 1,
    part: 0,
    title: "晶圓廠如何運作",
    station: "晶圓廠",
    intro: "晶圓被裝進 FOUP，由天車載著穿過無塵室的天花板，來到這座日夜不停運轉的工廠。",
    path: "zh-TW/0-before-you-start/01-how-a-fab-works/README.md",
    challenges: [
      {
        type: "quiz",
        alarm: true,
        q: "一台機台剛完成保養，零件換新、腔體清潔過，生產線催著要用。你該怎麼做？",
        options: [
          "直接開放生產，節省時間",
          "先跑測試晶圓檢查微粒、膜厚等，合格後才開放生產",
          "先放一批產品晶圓試跑看看",
          "只要看一眼外觀就好"
        ],
        answer: 1,
        explain: "保養會改變機台狀態，要先跑測試晶圓確認（現場叫 Qual），否則第一批產品可能整批報廢。"
      },
      {
        type: "truefalse",
        q: "無塵室就是完全沒有灰塵的空間。",
        answer: false,
        explain: "無塵室不是完全沒有灰塵，而是依每單位體積的微粒數量分級，數字越小越乾淨。"
      },
      {
        type: "match",
        q: "把搬運設備配對到用途",
        pairs: [
          ["FOUP", "裝晶圓的密封盒，最多 25 片"],
          ["OHT 天車", "在天花板軌道上運送 FOUP"],
          ["Stocker", "暫時存放等待中的 FOUP"],
          ["Load Port", "機台前方放 FOUP 的平台"]
        ],
        explain: "晶圓裝在 FOUP 裡，由天車運送、倉儲暫存，再放到機台的 Load Port 讓機台取出晶圓。"
      },
      {
        type: "quiz",
        q: "生產線上的在製品（WIP）越多，會發生什麼事？",
        options: [
          "良率一定上升",
          "每片晶圓排隊等機台的時間變長，生產週期變長",
          "機台保養次數變少",
          "產出一定增加"
        ],
        answer: 1,
        explain: "WIP 越多，晶圓排隊越久，就像車越多高速公路越塞。"
      }
    ]
  }
]);
