// Wafer Quest level data — Part 6 (zh-TW). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("zh-TW", [
  {
    chapter: 23, part: 6,
    title: "工廠如何被系統管理",
    station: "中控室",
    intro: "回頭一看，我們的晶圓其實從沒走錯路：每一次進站、出站，都有系統在指揮和記錄。",
    path: "zh-TW/6-beyond-the-fab/23-fab-systems/README.md",
    challenges: [
      { type: "match", q: "把系統配對到比喻",
        pairs: [["MES","工廠的大腦和帳本"],["派工系統","交通號誌"],["機台自動化","機台的翻譯員"],["良率分析","偵探"]],
        explain: "MES 記錄每批晶圓的位置與下一步，派工決定下一批做誰，機台自動化連接機台與 MES，良率分析整合數據找原因。" },
      { type: "order", q: "把晶圓到站後的流程排成正確順序",
        items: ["放上 Load Port","系統逐項確認","下載 Recipe、進站","加工並送出數據","出站、寫入履歷","決定下一站"],
        explain: "先讀取晶圓盒、通過所有檢查，才下載 Recipe 並記錄進站；加工後出站寫入履歷，再由系統決定下一站。" },
      { type: "quiz", alarm: true, q: "急件趕著出貨，有人想暫時跳過某個系統檢查。你該怎麼做？",
        options: ["先跳過，出貨後再補","走正式申請與核准，並留下紀錄","私下請機台操作員處理","直接關掉防呆規則"],
        answer: 1,
        explain: "很多規則來自過去的事故。例外必須經過正式核准並留下紀錄，事後也要檢討規則。" },
      { type: "truefalse", q: "系統上顯示已出站、但晶圓其實還沒做完，就是現場說的「帳實不符」，必須立即處理。", answer: true,
        explain: "系統上的狀態和實體晶圓必須一致，不一致就必須立即處理。" }
    ]
  },
  {
    chapter: 24, part: 6,
    title: "製程如何影響韌體",
    station: "終端產品",
    intro: "旅程的終點：我們的晶圓已經變成一顆顆晶片，裝進了產品裡。現在換韌體上場，而製程的脾氣，就藏在每一條規定裡。",
    path: "zh-TW/6-beyond-the-fab/24-process-and-firmware/README.md",
    challenges: [
      { type: "truefalse", q: "DRAM 的溫度越高，漏電越快，所以刷新的頻率通常要提高。", answer: true,
        explain: "DRAM 的電容會漏電，溫度越高漏得越快，因此高溫下刷新頻率通常要提高。" },
      { type: "match", q: "把 NAND 的限制配對到韌體對策",
        pairs: [["不能直接覆寫","FTL 與垃圾回收"],["抹寫次數有限","平均抹寫"],["出廠就有壞區塊","壞區塊管理"],["電荷慢慢流失","強力 ECC、讀取重試"]],
        explain: "韌體裡每一項功能，都對應到一個來自物理的限制。" },
      { type: "quiz", alarm: true, q: "你在韌體裡看到一個看不出道理的時序參數。修改之前，最好先做什麼？",
        options: ["直接改成覺得合理的值","找出它的來源，例如規格書或特性量測報告","整段刪掉","在幾片樣品上測一下就好"],
        answer: 1,
        explain: "這些數字通常來自大量晶片在不同溫度、電壓下的實測，已包含製程變異與老化的餘裕。" },
      { type: "quiz", q: "晶片版本從 A0 改成 A1，通常代表什麼？",
        options: ["電晶體也改了，要重做大部分光罩","只修改了上層的金屬導線","只是換了封裝","晶片壞掉被召回"],
        answer: 1,
        explain: "常見慣例是：字母改變代表底層電晶體也有修改，數字改變代表只改上層金屬，實際規則依各公司而定。" }
    ]
  }
]);
