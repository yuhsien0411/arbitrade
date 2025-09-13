## 專案總覽（需求／開發架構／檔案結構）

本文件彙整系統需求、整體架構設計與目前檔案結構，作為開發與協作的統一參考。本文不包含詳細程式碼。

---

### 一、系統需求（Business & Technical Requirements）

- **目標**: 建立多交易所（Bybit、Binance，預留 OKX、Bitget）之套利系統，支援現貨／合約、跨所與同所（期現）套利。
- **核心能力**:
  - **行情蒐集**: 以公開 API/WebSocket 取得訂單簿／ticker，提供低延遲資料流。
  - **套利偵測**: 依交易對（含 qty/totalAmount、threshold、direction）動態計算價差與觸發判斷。
  - **下單執行**: 兩腿同時執行（併發與風險控制），提供 TWAP 策略選項。
  - **資金與風險**: 風險參數（滑點、最大敞口、單筆／總額限制、重試與熔斷）。
  - **監控與告警**: 性能/錯誤/策略監控，重要事件告警（終端、Webhook、郵件預留）。
- **非功能性需求**:
  - **穩定性**: 交易所 API 失效／限流時可降級（publicOnly、模擬資料回退）與重試。
  - **可觀測性**: 後端集中化日誌（winston）、前端自定義 logger（控制台與WS回傳後端）。
  - **可延展性**: 以 `BaseExchange` 抽象層與 `ExchangeFactory` 新增交易所；模組化服務。
  - **效能**: 緩存（短 TTL）、併發請求、動態輪詢間隔。
  - **安全**: API Key 以環境變數與伺服器端保護；前端僅用公開資料。

---

### 二、整體架構（Architecture）

- **前端（React + Redux Toolkit + Ant Design）**
  - UI：套利配置（`qty`、`totalAmount`、`threshold`）、即時價差、策略管理（TWAP）、儀表板。
  - 資料來源：
    - 直接呼叫交易所公開 API（交換層封裝於 `exchangeApi.ts`）。
    - 呼叫後端 REST（價格代理、監控資料、帳戶資訊）。
    - WebSocket：前端重要業務日誌回傳後端顯示；行情 WS 預留。
  - 日誌：`client/src/utils/logger.ts` 過濾技術噪音、只上傳關鍵業務事件。

- **後端（Node.js + Express）**
  - API 層：`server/routes`（價格、監控、帳戶、設定、套利執行）。
  - WebSocket：`server/websocket/handler.js` 接收前端日誌、推送監控訊息。
  - 服務層：
    - `ArbitrageEngine`：掌控交易所、監控交易對、套利偵測與執行、動態輪詢、性能紀錄。
    - `OrderBookMonitor`：以公開 API 取得訂單簿、更新快取與廣播。
    - `PerformanceMonitor` / `ArbitragePerformanceMonitor`：延遲、錯誤、策略績效統計。
    - `ExchangeStatusService` / `CacheManager`：狀態與緩存管理。
  - 交易所抽象：
    - `BaseExchange` 與 `ExchangeFactory`：統一接口、`publicOnly` 模式。
    - `BybitExchange`、`BinanceExchange`；Bybit 提供 `BybitPublicClient`；Binance 提供 `BinancePublicClient`。
    - 與舊邏輯兼容：`BybitCompatibilityAdapter`（若需要，已支援 `getBalance`/`getPositions`）。
  - 日誌：`winston` 集中式，API 請求過濾（降低重複 GET 噪音）。

- **資料層**
  - MongoDB（主數據：價格歷史、策略、交易紀錄）— 可延後上線；現階段以記憶體/快取為主。
  - Redis（快取）— 選配；目前以應用內 `CacheManager` 為主。

- **部署與運維**
  - Docker 與 docker-compose（規劃中）。
  - `.env`：API Key 與配置（不存在時後端以 `publicOnly` 降級不當機）。

---

### 三、關鍵模組與資料流

- **價格資料流（公有）**
  1. 前端以 `exchangeApi.ts` 直連 Bybit/Binance 公有端點（避免敏感憑證暴露）。
  2. 若遇 CORS 或需要統一格式，改走後端 `/api/prices/:exchange/:symbol` 代理。
  3. 後端以 `OrderBookMonitor`/交易所 client 取得資料，短 TTL 緩存（例如 2 秒），回傳前端。

- **套利偵測與執行**
  - 偵測：`ArbitrageEngine` 以監控清單（pairConfig：`qty`、`totalAmount`、`threshold`、`direction`、`enabled`）計算價差與觸發條件。
  - 執行：兩腿並發下單；支援同所（期現）與跨所；回寫績效與錯誤。
  - 風控：滑點閾值、失敗重試、熔斷、佔用金額上限（以 `consumedAmount` 對 `totalAmount` 進度控制）。

- **觀測性與日誌**
  - 前端：
    - 控制台只顯示必要業務訊息；WS 僅上傳關鍵事件（套利觸發、成功/失敗、連線變更）。
  - 後端：
    - API 請求／回應摘要（排除重複 GET），WebSocket 連線／訊息、策略事件、性能與錯誤統計。

---

### 四、API 介面（摘要）

- 價格與監控
  - `GET /api/prices/:exchange/:symbol`：即時訂單簿（含緩存）；支援 `bybit`、`binance`。
  - `POST /api/prices/batch`：批量訂單簿（短 TTL 緩存）。
  - `GET /api/monitoring/pairs`：取得監控交易對列表（可先回傳 mock）。
  - `POST /api/monitoring/pairs`：新增監控交易對（含 `qty` / `totalAmount` / `threshold` / `direction`）。
  - `PUT /api/monitoring/pairs/:id`、`DELETE /api/monitoring/pairs/:id`：維護監控交易對。

- 套利與策略
  - `POST /api/arbitrage/execute/:pairId`：手動觸發雙腿執行（測試用）。
  - TWAP：`/api/twap/*`（策略 CRUD）。

- 設定與狀態
  - `GET /api/settings/api`、`PUT /api/settings/api`、`POST /api/settings/api/test`：後端保存 API Key；測試回覆永遠 `success: true` 並附 `connected` 旗標。
  - `GET /api/exchanges/*`：已實作／已連線／功能支援清單等說明。
  - `GET /api/account/:exchange`：`getBalance()`、`getPositions()`（publicOnly 時回傳模擬資料）。

---

### 五、開發重點與規範

- **抽象與擴展**
  - 所有交易所實作遵循 `BaseExchange`；以 `ExchangeFactory` 建立，統一 `validateConfig(publicOnly)`。
  - Bybit/Binance 提供 PublicClient；OKX/Bitget 接口預留但暫不開發。

- **錯誤處理**
  - 使用 `TradingError`；API 層提供一致的 `success` 與 `error` 欄位結構。
  - Public API 失敗（如 502）採用短期 mock 回退避免系統中斷，並記錄錯誤。

- **性能與快取**
  - 以 `CacheManager` 對價格資料設置 1–3 秒 TTL（依波動度動態調整）。
  - 大量請求使用 `Promise.allSettled`、並發批次與退避策略。

- **日誌與可觀測性**
  - 後端：`winston` + requestLogger（只記錄非 GET、/error、/test 或 >=400）。
  - 前端：自定義 logger 過濾「API/WebSocket/Redux」等技術噪音，僅回傳重要業務事件。

- **環境變數**
  - `.env` 不可讀；以程式內判斷 `publicOnly`（無金鑰不當機）。

---

### 六、檔案結構（精要）

```text
arbi/
├─ server/
│  ├─ index.js                           # 後端入口（Express + WS + 引擎初始化）
│  ├─ routes/
│  │  ├─ api.js                          # REST 端點（價格、帳戶、設定、監控）
│  │  └─ monitoring.js                   # 監控相關端點（mock/簡版）
│  ├─ services/
│  │  ├─ arbitrageEngine.js              # 套利引擎（監控/執行/性能記錄/降級）
│  │  ├─ PerformanceMonitor.js           # 通用性能監控
│  │  ├─ ArbitragePerformanceMonitor.js  # 套利績效監控（如存在）
│  │  ├─ OrderBookMonitor.js             # 公開訂單簿資料抓取與更新
│  │  ├─ ExchangeStatusService.js        # 交易所狀態與健康檢查
│  │  └─ CacheManager.js                 # 應用層快取
│  ├─ exchanges/
│  │  ├─ index.js                        # ExchangeFactory / 設定驗證（publicOnly）
│  │  ├─ base/
│  │  │  └─ BaseExchange.js              # 交易所抽象
│  │  ├─ bybit/
│  │  │  ├─ BybitExchange.js             # Bybit 主要實作
│  │  │  ├─ BybitPublicClient.js         # Bybit 公開 API client
│  │  │  └─ BybitCompatibilityAdapter.js # 舊介面兼容（如需）
│  │  └─ binance/
│  │     ├─ BinanceExchange.js           # Binance 主要實作
│  │     ├─ BinancePublicClient.js       # Binance 公開 API client
│  │     └─ ...                          # REST/WS 客戶端
│  ├─ websocket/
│  │  └─ handler.js                      # WS 連線與前端日誌收集
│  ├─ utils/
│  │  └─ logger.js                       # winston 設定
│  └─ models/                             # MongoDB 模型（可選）
│
├─ client/
│  ├─ src/
│  │  ├─ pages/
│  │  │  ├─ ArbitragePage.tsx            # 套利配置與即時價差
│  │  │  ├─ SettingsPage.tsx             # API/風險設定與測試
│  │  │  ├─ TwapPage.tsx                 # TWAP 策略管理
│  │  │  └─ Dashboard.tsx                # 系統儀表板
│  │  ├─ services/
│  │  │  ├─ api.ts                       # 後端 REST 封裝
│  │  │  └─ exchangeApi.ts               # 交易所公開 API 封裝
│  │  ├─ store/
│  │  │  └─ slices/                      # exchangesSlice / arbitrageSlice
│  │  └─ utils/
│  │     └─ logger.ts                    # 前端日誌（過濾與上傳）
│  └─ index.tsx / App.tsx / ...
│
├─ Test.py / quick_test.py               # 後端 API/流程快速驗證腳本
└─ SYSTEM_OVERVIEW.md                    # 本文件
```

---

### 七、里程碑與落地建議（高階）

- M1（可用版，已完成/持續優化）
  - Bybit/Binance 公開行情通路、價格代理 API、前端監控頁面（10s 輪詢）。
  - ArbitrageEngine 基礎：監控對清單、價差計算、雙腿執行骨架、性能/錯誤記錄。
  - 日誌整治：前端過濾、後端 API Logger 降噪、WS 後送。
  - publicOnly 降級：無 API Key 仍可啟動與測試。

- M2（交易與策略）
  - 下單通道（模擬 → 真實）、期現/跨所一致介面、TWAP 策略與進度管控（`qty`/`totalAmount`）。
  - 風險管理完整：滑點、重試、熔斷、額度與資金佔用。

- M3（觀測與部署）
  - 監控看板/告警通道、MongoDB 歷史存儲、Redis 快取。
  - Docker 化與部署腳本。

---

### 八、協作規範（摘要）

- PR 規範：描述「目的／變更點／風險／回滾方案」。
- 日誌規範：只記錄必要業務訊息；避免在終端與控制台重複輸出。
- 變更原則：先抽象（interface/adapter），再替換具體實作，確保熱更新可用且不中斷。
- 測試規範：以 Python 腳本與 Jest 進行接口與流程驗證；盡量使用真實資料源。


