# PM 指令 - 前端開發者C（兩天內可用版）

## 🎯 任務概述
- 目標：在 2 天內交付「可用版」跨交易所套利前端，完成關鍵交互、表單校驗、與後端最小集成，確保可配置監控交易對並看到即時監控狀態/反饋。
- 範圍：不追求最終視覺完善；優先可用度、穩定性、錯誤提示與關鍵流程打通。
- 相關頁面：`client/src/pages/ArbitragePage.tsx`、`client/src/services/api.ts`、`client/src/services/websocket.ts`、`client/src/store/slices/*`、`client/src/components/*`

---

## 🗓 時程
- Day 1：表單完備 + 狀態來源打通 + 校驗與提示
- Day 2：即時數據顯示 + 體驗強化 + 自測與驗收

---

## ✅ 驗收標準（必達）
- 表單完整可用：
  - 交易所下拉能顯示「實作狀態」（Bybit/已知/未實現），未實現的不可選並有原因提示。
  - 交易類型（現貨/合約）、買賣方向、交易對為必填，有即時校驗與錯誤提示。
  - 常用交易對快捷鍵可一鍵帶入兩邊 Leg 的預設值。
- API 打通：
  - 能從後端獲得交易所狀態與可用交易對清單（若無對應接口，先本地 mock，接口就緒後切換）。
  - 可提交「新增監控交易對」，提交中顯示 loading，成功/失敗有 toast。
- 即時資訊：
  - 選定交易對後，能即時顯示當前買一/賣一價（單或雙邊，取決於可用的 WS 資料）。
- 體驗與穩定性：
  - 表單缺漏或格式錯誤禁止提交；所有錯誤有清晰提示，不崩潰。
  - 頁面重新整理後，已配置的監控列表可被讀取並展示（若後端尚無列表接口，可暫以本地 store 模擬，並預留替換層）。

---

## 🔧 Day 1 任務細項
1) 交易所與狀態顯示（高）
   - 在 `api.ts` 新增：`getExchangeStatus()`，對接後端（如：`GET /api/exchanges/status`）。
   - 在 `ArbitragePage.tsx` 載入並緩存狀態，於下拉清晰標注：`已知/未知/未實現`；未實現置灰並加 tooltip。
2) 表單結構與校驗（高）
   - 使用受控表單：交易所、類型、方向、交易對、觸發閾值、數量、啟用狀態。
   - 即時校驗：必填、數值範圍（百分比 0–10、數量 >0，保留小數位提示）。
   - 缺失或錯誤時禁用「新增」。
3) 常用交易對快捷（中）
   - 點擊 chips（BTCUSDT、ETHUSDT…）自動帶入兩側 `symbol` 與預設方向（買/賣），可再修改。
4) API 集成（中）
   - `api.ts` 新增：
     - `getSymbols(exchange: string): Promise<string[]>`（若無後端，先 mock）
     - `addWatchPair(payload)`：提交監控
   - 封裝錯誤處理與超時，返回統一格式 `{ success, data?, error? }`。
5) 全局反饋（中）
   - 成功/失敗 toast，提交期間按鈕和表單 disable，避免重複提交。

---

## 📡 Day 2 任務細項
1) 即時數據（高）
   - `websocket.ts`：提供 `subscribeTicker(exchange, symbol)`，返回最小資料結構 `{ bid, ask, ts }`。
   - `ArbitragePage.tsx`：選定交易對後，展示雙邊當前 `bid/ask`，無資料顯示暫無資料。
2) 監控列表（中）
   - 右側或底部展示「已監控交易對列表」：symbol、兩邊交易所、啟用狀態、最近更新時間。
   - 提供最小操作：啟用/停用切換（若後端尚未提供接口，先本地管理與明確標註）。
3) 體驗與保護（中）
   - 全頁 loading、空狀態、錯誤邊界。
   - 將當前表單與列表狀態保存在 store，以便刷新恢復（如 localStorage 持久化）。
4) 自動化檢查（中）
   - 新增 3–5 個前端測試（React Testing Library）：表單校驗、提交狀態、未實現交易所禁用。

---

## 📎 API 約定（前端視角）
- `GET /api/exchanges/status` → `{ success, data: [{ name: 'bybit', implemented: true, connected: bool }, ...] }`
- `GET /api/exchanges/:name/symbols` → `{ success, data: ['BTCUSDT', 'ETHUSDT', ...] }`（若暫無，用 mock）
- `POST /api/arbitrage/watch-pairs` → body: `{ leg1, leg2, thresholdPct, amount, enabled }`，回 `{ success, id }`
- WebSocket：`subscribeTicker(exchange, symbol)` 事件名和資料格式，對齊當前後端/現有服務（若無，前端自封裝統一格式）。

---

## 🧱 技術落點
- 檔案
  - `client/src/pages/ArbitragePage.tsx`：表單與列表、即時顯示、交互
  - `client/src/services/api.ts`：新增/封裝 API 方法與 mock 開關
  - `client/src/services/websocket.ts`：新增 subscribe/unsubscribe API
  - `client/src/store/slices/exchangesSlice.ts`：狀態、symbols、loading/error
  - `client/src/store/slices/arbitrageSlice.ts`：監控列表、提交狀態
- UI/UX
  - 所有操作均有 loading/disabled/結果提示
  - 未實現/未知狀態的明確標示與說明

---

## 🧪 自測清單（開發者自核對）
- [ ] 未實現交易所無法選擇，並有 tooltip 說明
- [ ] 表單缺漏或格式錯誤時，「新增」按鈕不可用
- [ ] 成功提交後出現成功提示並更新列表
- [ ] 選定交易對能顯示即時 bid/ask
- [ ] 刷新頁面後能看到先前新增的監控項（使用本地持久化或後端接口）
- [ ] 錯誤情況能展示清晰錯誤，不崩潰

---

## 📚 參考與對齊
- 後端狀態來源：`server/services/ExchangeStatusService.js`
- 既有監控：`server/services/MonitoringDashboard.js`、`routes/monitoring.js`
- 套利頁面邏輯對齊：`server/services/arbitrageEngine.js`

---

## 📦 交付物
- 可用的表單與列表交互（提交/顯示/錯誤保護）
- `api.ts` 與 `websocket.ts` 的最小封裝 + mock 開關
- 前端最小測試（3–5 個）與操作說明（README 小節或頁內說明）

---

## 🧭 風險與回退
- 若後端 symbols/列表接口暫缺，前端先以 mock 實作，提供 `USE_MOCK=true` 切換；後端就緒再替換。
- WebSocket 若暫不穩定，fallback 為輪詢（2–3 秒）取價。

---

## 📝 進度追蹤
- Day 1：
  - [ ] 狀態下拉與禁用/提示完成
  - [ ] 表單校驗完成
  - [ ] 提交 API 與 loading/toast 完成
- Day 2：
  - [ ] 即時 ticker 顯示完成
  - [ ] 監控列表展示與基本操作完成
  - [ ] 測試編寫與自測通過

---

最後更新：Day 1 開始

---

## 📣 今日指令（立即執行）
1) `client/src/services/api.ts`
   - 新增並導出：`getExchangeStatus()`, `getSymbols(exchange)`, `addWatchPair(payload)`。
   - 增加 `USE_MOCK` 切換（讀取 `import.meta.env.VITE_USE_MOCK` 或 `process.env.REACT_APP_USE_MOCK`）。
   - 統一回傳格式：`{ success: boolean, data?: T, error?: string }`，所有錯誤都 catch 並轉為此格式。

2) `client/src/store/slices/exchangesSlice.ts`
   - state：`status: Record<string,{implemented:boolean,connected:boolean}>`, `symbols: Record<string,string[]>`, `loading`, `error`。
   - thunks：`fetchExchangeStatus()`, `fetchSymbols(exchange)`。

3) `client/src/store/slices/arbitrageSlice.ts`
   - state：`watchPairs: []`, `submitting`, `error`。
   - thunk：`addWatchPairThunk(payload)`，提交成功後 push 至 `watchPairs`。

4) `client/src/pages/ArbitragePage.tsx`
   - 完成表單：兩個 Leg 的交易所/類型/方向/交易對，閾值%、數量、啟用狀態。
   - 校驗：必填；閾值 0–10；數量 >0；不合法時禁用提交按鈕並顯示錯誤訊息。
   - 下拉行為：未實現的交易所項置灰（依 `status`），並顯示 tooltip「未實現/不可選」。
   - 常用交易對 chips：點擊自動帶入兩側 symbol 與預設方向。
   - 提交：呼叫 `addWatchPair`，顯示 loading 與成功/失敗 toast。

5) `client/src/services/websocket.ts`
   - 導出 `subscribeTicker(exchange, symbol)` 與 `unsubscribeTicker(key)`；回傳 `{ bid, ask, ts }`，若暫無 WS 資料，先留擴充點，使用輪詢代替。

6) 測試（最小）
   - 使用 React Testing Library 新增 3 項：
     - 未填必填時禁用提交。
     - 選擇未實現交易所應顯示禁用與提示。
     - 成功提交後顯示成功訊息並重置表單部分欄位。

完成後於 `pmC.md` 的進度追蹤勾選並回報。若後端 symbols 或列表 API 暫缺，先以 mock 實作，保持介面一致以便後續替換。


