# 晶圓帝國 Wafer Empire — 交接給 Codex

## 專案是什麼
以《半導體製造概論》(chenwei810/Semiconductor_Manufacturing_Introduction，CC BY-NC-SA 4.0) 為素材的網頁遊戲：
晶圓廠經營（大亨）＋ 製程剖面解謎（每座新廠要先過解謎才能開通）。純 HTML/CSS/JS ES modules，不需 build、不用 CDN。

- 線上：https://paul931130.github.io/Semiconductor_Manufacturing_Introduction/empire/
- Repo：https://github.com/paul931130/Semiconductor_Manufacturing_Introduction （使用者的 fork）
- 分支：`feature/wafer-empire`（開發）＝ `master`（GitHub Pages 來源）。改完兩個都要推。
- 原作者 repo 不要動；曾開 PR #1 後已關閉，未經使用者同意不要再開。
- `add-wafer-quest-game` 分支是被放棄的舊問答遊戲，不用管。

## 本機執行與測試
```bash
python -m http.server 8800 --directory empire     # 開 http://localhost:8800/
node empire/js/puzzle/levels.test.js               # 21 關可解性與最短步數（310 項）
node empire/js/tycoon/economy.test.js              # 經濟公式、節奏、合約等
node empire/js/tycoon/headless.js                  # 貪婪策略模擬，看各廠解鎖天數
```
注意：瀏覽器會快取 ES module，改完換個 port 或強制重新整理。

## 結構（詳見 empire/DESIGN.md、empire/README.md）
- `js/main.js` 啟動與 hash 路由（#title #hub #fab/fN #unlock/fN #puzzle/fN）；`js/tutorial.js` 教學（步驟 mode:'next' 才能按下一步）
- `js/puzzle/*` 解謎：engine.js 純函式、levels.json（含 reference 解）、ui.js、renderer.js（Canvas）
- `js/tycoon/*` 經營：economy.js 純公式（傳入 bal）、sim.js（stepTick，24 tick＝1 日）、state.js、market-view.js（市場/合約/轉速）、factory-view.js（Q版寫實無塵室、FOUP 軌道）、hud.js、events.js、bridge.js（window.EmpireBridge ↔ window.startPuzzleSet）
- `js/npc/*` + `data/dialogue.json`：三個 NPC（林姐 廠務經理、阿哲 製程工程師、Vivian 業務）負責事件、合約、教學的台詞
- `js/fab-art/machines.js` 機台 SVG；`js/audio.js` WebAudio 音效與環境音
- `data/balance.json` 所有數值；`data/content.json` 從書中萃取的製程/名詞/小知識
- 存檔：localStorage `waferEmpire.save`，`js/shared/storage.js` 有 SAVE_VERSION 與 migrate 鏈，改存檔結構要升版並寫 migration

## 最近完成（2026-10-14）
回應使用者「沒錢就卡住」：每座廠產線模式（運轉／只做完在製品／暫停／停機封存）、銀行貸款與緊急出清、自動賣出與低資金保護、死局救援（林姐對話：貸款／賣機台／股東增資），SAVE_VERSION=3。邏輯在 js/tycoon/ops-view.js、rescue.js、economy.js；DESIGN.md §3.9。
接手時先 `git status`、跑兩套測試。

## 下一步建議
- 2026-10-14 優化：新遊戲現金 9,500、開廠完整預算、值班建議與訂單保留量快捷出售、手動出售保留量確認、接單確認跨 tick 保留。機台即時加工／等下站／HOLD 狀態、金屬陰影與手機軌道標籤；復原改立即刷新。詳見 DESIGN.md §3.10。
- 已驗證經濟 41 項、手機與桌機 360/375/768/1280 無整頁橫向溢出、快捷出售保留訂單庫存、tick 後二次確認、連按復原兩步、瀏覽器無執行錯誤。新遊戲基本配置可完成首批並保有一批投片資金。
- 12 種子貪婪策略 Fab 2 可負擔中位第 27 天（12–39）；後續廠節奏尚未重新測量。
- 實機聽音效、看 Q版畫面，依使用者回饋微調

## 已知問題
- 音效音量比例沒人實際聽過；Q版畫面只有子代理截圖確認過
- 手機工具列改為橫向捲動；最右側功能需滑動查看
- dialogue.json 的 47 句閒聊建議人工審一次技術內容

## 使用者偏好
- 繁體中文溝通；重視「好玩」與「身歷其境」（Q版寫實風）
- 做完、測過就直接推上線（feature/wafer-empire 與 master）；動到原作者 repo 前要先問
