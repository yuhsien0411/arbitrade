### 主旨
Python 後端重構 Kickoff 與驗收清單（供後端工程師/前端工程師/PM 共同對齊與驗收）

---

### 1) 參考資料與來源
- 系統與需求說明：`USER_REQUIREMENTS_AND_ARCHITECTURE_TW.md`
- API JSON 契約：同文件第十章「前後端 API 約定與 JSON 規格」
- 重構計畫與里程碑：`PYTHON_BACKEND_REFACTOR_PLAN.md`

---

### 2) 環境、分支與埠
- 新資料夾：`python_backend/`（與 `server/` 併行）
- 埠與啟動：FastAPI/uvicorn 於 7000 埠（開發使用 `--reload` 熱啟動）
- 前端 Base URL：以設定切換（不可直接讀 `.env`，遇到問題先從程式邏輯排查）
- 分支策略：`feature/python-backend`（禁止自動上傳 GitHub，PR 需負責人確認）

---

### 3) 技術選型（後端）
- Web/執行：FastAPI（ASGI）、uvicorn `--reload`
- 資料模型：Pydantic v2（DTO 驗證與序列化）
- HTTP 客戶端：httpx（async、連線池、重試/退避）
- WebSocket：FastAPI 原生 `WebSocket`
- 緩存：記憶體 TTLCache（可選接 Redis 於後續階段）
- 日誌：structlog + logging（JSON 格式，欄位：event, exchange, pairId, latency_ms, success, error_code）
- 交易所封裝：
  - Bybit：pybit（官方、穩定，依用戶慣例）
  - Binance：binance-connector（async）或 python-binance（依需求選用）
- 測試：pytest、pytest-asyncio、httpx.AsyncClient（整合測試）

---

### 4) 指標與規範（基準目標）
- 效能：API P95 < 200ms；WS 事件延遲 < 100ms
- 統一回包：`{ success, data?, error?{ code, message } }`
- 數據來源：必為真實資料；有問題直接拋錯，禁用假資料
- 啟動：熱啟動（修改程式碼不需手動重啟）
- 安全：`.env` 不可讀，僅後端託管金鑰；若無金鑰需 graceful（publicOnly）

---

### 5) 里程碑與時程（工作日估）
- 階段 0（1–2 天）：腳手架與基礎
  - 建立 `python_backend/`、FastAPI 服務（/health）、結構化日誌、TTLCache、httpx 客戶端
- 階段 1（3–4 天）：只讀 API
  - GET `/api/prices/:exchange/:symbol`
  - POST `/api/prices/batch`
  - 監控 pairs CRUD
  - GET `/api/exchanges`、GET `/api/account/:exchange`
- 階段 2（2–3 天）：WebSocket 基礎
  - `/ws`、連線管理、事件格式對齊、斷線重連
- 階段 3（5–7 天）：套利引擎與下單灰度
- 階段 4（3–4 天）：TWAP 策略
- 階段 5（3–4 天）：優化與驗收
- 階段 6（1–2 天）：切流與退役

---

### 6) 階段優先順序（Stage 1 只讀 API）
1. GET `/api/prices/:exchange/:symbol`
2. POST `/api/prices/batch`
3. 監控 pairs CRUD
4. GET `/api/exchanges`、GET `/api/account/:exchange`

對齊要求：回應結構與 `USER_REQUIREMENTS_AND_ARCHITECTURE_TW.md` 第十章保持一致；必要新增欄位需後向相容。

---

### 7) 前端頁面 ↔ API 端點對應
- `client/src/pages/ArbitragePage.tsx`
  - 讀取即時訂單簿：GET `/api/prices/:exchange/:symbol`
  - 批次訂單簿：POST `/api/prices/batch`
  - 監控對清單（列表/新增/更新/刪除）：`/api/monitoring/pairs*`
  - 手動執行套利（測試用，後續階段）：POST `/api/arbitrage/execute/:pairId`
- `client/src/pages/TwapPage.tsx`
  - TWAP 設定與控制（後續階段）：`/api/twap/*`
- `client/src/pages/Dashboard.tsx`
  - 系統與交易所狀態：GET `/api/exchanges`
  - 帳戶資訊：GET `/api/account/:exchange`
  - 即時事件（後續階段）：`/ws`（`price_update`、`opportunity` 等）
- `client/src/pages/SettingsPage.tsx`
  - API 金鑰設定/測試（需後端僅持有金鑰，前端不暴露）：`/api/settings/api*`

---

### 8) 交付節點（Definition of Done，逐端點驗收）
端點完成 =
- 程式碼（含 DTO 與錯誤處理）
- 單元/整合測試（pytest、pytest-asyncio、httpx.AsyncClient）
- OpenAPI 自動文件（/docs 與 /openapi.json 可用）
- 範例請求/回應 JSON（置於文件或測試資料夾）
- 日誌與錯誤規格驗證（structlog 欄位、Envelope 一致）
- 前端串接驗收通過（對應頁面正常顯示）

提交 PR 前須附：自測結果、P95/錯誤率/（若有）WS 延遲指標。

---

### 9) 測試策略
- 單元：覆蓋 DTO、Cache、業務方法與錯誤分支
- 整合：以 httpx.AsyncClient 測 REST 與 WS（後續）
- 優先真實資料；必要時 mock 明確標註（含限流/429/5xx）
- 覆蓋性能門檻與降級行為（publicOnly）

---

### 10) 日誌與錯誤
- 結構化日誌欄位：`event, exchange, pairId, latency_ms, success, error_code`
- 錯誤回包：`{ success:false, error:{ code, message } }`
- 僅記錄必要摘要與 >=400 錯誤；分類 performance/error

---

### 11) 風險控管與對策
- 真實下單風險：小額實單 $10–50、雙重價格確認、滑點/限額/再驗證、熔斷
- 延遲與不穩：連線池+重試/退避、TTLCache、非同步化、監控 P95
- 限流/故障：節流（每窗口配額）、退避重試、降級 publicOnly、清楚告警
- 契約飄移：嚴格遵守第十章契約；新增欄位後向相容
- 金鑰與安全：後端持有、不可讀 `.env`，缺金鑰時 graceful 降級

---

### 12) 每日溝通節奏
- 每日站會（5 分鐘）：昨天完成、今天計畫、阻礙/風險
- 當日狀態更新（簡訊息）：
  - 已完成端點與測試覆蓋率
  - 指標：P95、錯誤率、WS 事件延遲
  - 需要前端配合的欄位/格式/節流建議

---

### 13) 需求變更與契約管理
- 任何 API 欄位/格式/語意調整 → 先提「契約變更」Issue
  - 附：影響面、回滾方案
  - 不得直接改動線上回應結構；加欄位需後向相容

---

### 14) 驗收清單（可逐項勾選）
- [ ] `python_backend/` 架構建立，`/health` 可用（7000）
- [ ] 結構化日誌與錯誤 Envelope 完成
- [ ] GET `/api/prices/:exchange/:symbol` 完成（含測試與 OpenAPI）
- [ ] POST `/api/prices/batch` 完成（含測試與 OpenAPI）
- [ ] 監控 pairs CRUD 完成（含測試與 OpenAPI）
- [ ] GET `/api/exchanges`、GET `/api/account/:exchange` 完成（含測試與 OpenAPI）
- [ ] 前端對應頁面串接驗收通過（Arbitrage/Dashboard/Settings）
- [ ] P95 < 200ms、錯誤率 < 1% 達標（只讀 API）
- [ ] WS 骨架（/ws）建立與延遲 < 100ms（後續階段）

說明：完成項目以 ✅ 標註。

---

### 15) 角色與責任（協作）
- 後端：端點與測試、OpenAPI、自測報告、延遲與錯誤率指標
- 前端：頁面串接、格式相容性驗證、必要時限流與重試策略
- PM/Reviewer：契約變更 Issue 審核、PR 驗收與合併


