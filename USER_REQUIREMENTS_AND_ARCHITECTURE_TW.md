# 🧭 用戶需求與系統架構整合文件（繁中）

## 目標
- 清晰列出「用戶需求與注意事項」
- 概述「系統架構與模組分工」
- 說明「關鍵資料流（行情/套利/TWAP/監控）」

---

## 一、用戶需求與注意事項

- 實時資料與真實交易環境
  - 所有數據需來自真實交易所（非測試網）；有問題直接拋錯，不使用虛假資料。
  - API 金鑰以環境變數託管；前端不暴露敏感憑證；無 `.env` 存取權限，先從程式邏輯排查。
- 研發與部署
  - 熱啟動：修改程式碼無需手動重啟（nodemon/hot reload）。
  - 禁止自動推送至 GitHub，任何上傳需經負責人確認。
- 前端體驗
  - 提供專業交易介面：套利配置（qty/totalAmount/threshold/direction）、即時價差、TWAP 策略、儀表板。
  - 清晰錯誤回饋與風險提示；重要事件可視化（成交、取消、重試、熔斷）。
- 風險控制
  - 風控參數：滑點閾值、最大持倉/單筆/日風險限額、重試與熔斷策略。
  - 價格偏差與異常行情檢測；必要時自動暫停策略並告警。
- 可觀測性
  - 後端：集中化日誌（winston），過濾重複 GET、分類性能/錯誤事件。
  - 前端：自訂 logger 僅上傳關鍵業務事件（套利觸發、成功/失敗、連線變更）。

---

## 二、系統架構總覽

- 前端（React 18 + TypeScript + Ant Design + Redux Toolkit）
  - 頁面：`ArbitragePage`、`TwapPage`、`Dashboard`、`SettingsPage`
  - 服務：`api.ts`（後端 REST）、`exchangeApi.ts`（交易所公有 API）、`websocket.ts`（事件/日誌）
- 後端（Node.js + Express + WebSocket）
  - 路由：`routes/api.js`、`routes/monitoring.js`
  - 引擎/服務：`services/arbitrageEngine.js`、`OrderBookMonitor.js`、`PerformanceMonitor.js`、`ExchangeStatusService.js`、`CacheManager.js`
  - 交易所：`exchanges/base/*` 抽象、`bybit/*`、`binance/*`，入口 `exchanges/index.js`
- 數據層
  - 以應用內快取為主（`CacheManager`）；MongoDB/Redis 可選（文檔與模型已規劃）。
- 運維
  - 日誌：`server/logs/*`；配置：`server/config/*`；熱更新：`nodemon.json`

### 架構圖（簡要）
```
Frontend (React/Redux)
  ├─ REST: client/src/services/api.ts  ->  Backend /api/*
  ├─ Public Prices: exchangeApi.ts     ->  Bybit/Binance Public API
  └─ WebSocket: websocket.ts           <-> Backend ws handler

Backend (Express + WS)
  ├─ routes/api.js, monitoring.js
  ├─ services/
  │   ├─ arbitrageEngine.js
  │   ├─ OrderBookMonitor.js
  │   ├─ PerformanceMonitor.js
  │   ├─ ExchangeStatusService.js
  │   └─ CacheManager.js
  └─ exchanges/
      ├─ base/* (BaseExchange/BaseRest/BaseWebSocket)
      ├─ bybit/* (PublicClient/Exchange)
      └─ binance/* (PublicClient/Exchange)
```

---

## 三、核心模組職責

- ArbitrageEngine（套利引擎）
  - 維護監控清單（pairConfig: qty/totalAmount/threshold/direction/enabled）
  - 價差計算與套利機會檢測；雙腿併發下單；進度與績效記錄
  - 風控：滑點/重試/熔斷/資金佔用上限；publicOnly 降級
- OrderBookMonitor（訂單簿監控）
  - 透過交易所公開端點抓取 bid1/ask1、深度；短 TTL 快取；必要時廣播
- Performance/Monitoring（性能與監控）
  - API/引擎延遲、錯誤率、成功率、緩存命中率；觸發門檻告警
- Exchange Abstraction（交易所抽象）
  - `BaseExchange` + `ExchangeFactory` 提供統一接口；`BybitPublicClient`、`BinancePublicClient` 對接公有資料

---

## 四、關鍵資料流

- 價格資料（公有）
  1) 前端以 `exchangeApi.ts` 直連 Bybit/Binance 公開端點
  2) 若需統一格式/避免 CORS：走後端 `/api/prices/:exchange/:symbol` 代理
  3) 後端抓取 → `CacheManager` 短 TTL（~0.5–2s） → 回傳前端

- 套利偵測與執行
  1) `ArbitrageEngine` 輪詢監控對 → 價差/方向判定
  2) 通過風控檢查 → 兩腿並發下單（跨所或期現）
  3) 回寫執行結果/績效與錯誤；必要時熔斷/暫停

- TWAP 策略（雙腿）
  1) 使用者設定標的、總量、時間窗、分片
  2) 引擎分片下單與進度回報；支援暫停/恢復/取消

- 可觀測性與事件
  - 前端關鍵事件透過 WS 回傳後端；後端集中記錄與彙總

---

## 五、API（重點摘要）

- Prices & Monitoring
  - GET `/api/prices/:exchange/:symbol`：即時訂單簿（支援 bybit/binance），含快取
  - POST `/api/prices/batch`：批次獲取多交易所訂單簿
  - GET `/api/monitoring/pairs`：監控清單（可先回傳 mock）
  - POST `/api/monitoring/pairs`：新增監控對（qty/totalAmount/threshold/direction）

- Arbitrage & TWAP
  - POST `/api/arbitrage/execute/:pairId`：手動觸發雙腿（測試用）
  - `/api/twap/*`：策略 CRUD 與執行控制

- Settings & Status
  - GET/PUT/POST `/api/settings/api`：API Key 設定/測試；無 `.env` 也需 graceful
  - GET `/api/exchanges/*`：交易所支援與連線狀態
  - GET `/api/account/:exchange`：餘額/持倉（publicOnly 時回傳受限或模擬）

---

## 六、風險與安全

- 金鑰與憑證
  - 僅後端持有、加密/保護存放；前端不透出；`.env` 不對外
- 風險控制
  - 滑點與價格偏差、單筆/日限額、重試/退避、熔斷/自動暫停
- 異常處理
  - 交易所限流/失效時降級（publicOnly/短期回退），並明確告警

---

## 七、開發規範與運行

- 日誌與降噪
  - 後端僅記錄必要摘要與 >=400 的錯誤；分類 performance/error
  - 前端過濾技術噪音，只回傳關鍵業務事件
- 熱啟動與穩定性
  - 後端 `nodemon`、前端 HMR；變更不需手動重啟
- 測試與驗收
  - 優先使用真實資料驗證；若需 mock，必標示並覆蓋錯誤/邊界路徑

---

## 八、路線圖（摘要）

- 近期：
  - Binance 深化（REST/WS、下單/取消、24h 統計、帳戶）
  - 實時分析儀表板（價差走勢/機會統計/盈虧）
  - 自動套利執行與完整風控
- 中期：
  - OKX/Bitget 接入、MongoDB/Redis 上線、監控與告警
- 長期：
  - 回測/模擬交易、機器學習優化、容器化與雲端部署

---

## 參考與對應程式
- 專案概述：`README.md`
- 架構詳述：`SYSTEM_ARCHITECTURE.md`、`SYSTEM_OVERVIEW.md`
- 後端服務：`server/services/*`
- 交易所封裝：`server/exchanges/*`
- 前端頁面與服務：`client/src/pages/*`、`client/src/services/*`
- 日誌與監控：`server/utils/logger.js`、`server/logs/*`

---

## 九、Python 後端重構設計（FastAPI/asyncio/uvicorn）

### 9.1 技術選型
- Web 框架：FastAPI（高性能 ASGI，類型註解，OpenAPI）
- 伺服器：uvicorn（或 hypercorn）
- 併發模型：asyncio + `async/await`，協程任務調度
- 排程與隊列：`asyncio.TaskGroup`（Python 3.11+）或 `anyio`；可選 `aiojobs`/`APScheduler`
- HTTP 客戶端：`httpx`（async，連線池，重試）
- WebSocket：`websockets` 或 FastAPI 原生 `WebSocket`
- 緩存：記憶體 `lru_cache` + 自訂 `TTLCache`；可接 Redis（`redis-py`/`aioredis`）
- 日誌：`structlog` + `logging`（JSON formatter，關鍵欄位）
- 資料模型：`pydantic` v2（驗證/序列化）
- 測試：`pytest` + `pytest-asyncio` + `httpx.AsyncClient`

### 9.2 目錄結構（建議）
```
python_backend/
  ├─ app/
  │  ├─ main.py                    # FastAPI 入口（路由掛載、事件生命週期）
  │  ├─ api/
  │  │  ├─ routes_prices.py        # /api/prices*
  │  │  ├─ routes_monitoring.py    # /api/monitoring*
  │  │  ├─ routes_arbitrage.py     # /api/arbitrage*
  │  │  └─ routes_settings.py      # /api/settings*
  │  ├─ services/
  │  │  ├─ arbitrage_engine.py     # 套利引擎（偵測/執行/TWAP）
  │  │  ├─ orderbook_monitor.py    # 訂單簿抓取與快取
  │  │  ├─ performance_monitor.py  # 性能/錯誤監測
  │  │  ├─ exchange_status.py      # 交易所健康檢查
  │  │  └─ cache_manager.py        # TTL 緩存
  │  ├─ exchanges/
  │  │  ├─ base.py                 # BaseExchange 抽象
  │  │  ├─ bybit.py                # Bybit Public/REST/WS
  │  │  └─ binance.py              # Binance Public/REST/WS
  │  ├─ models/
  │  │  ├─ dto.py                  # 請求/回應 DTO（pydantic）
  │  │  └─ domain.py               # 域模型（交易對、訂單、策略）
  │  ├─ ws/
  │  │  └─ handler.py              # WebSocket 事件與廣播
  │  ├─ utils/
  │  │  ├─ logger.py               # structlog 設定
  │  │  └─ http.py                 # httpx 客戶端、重試、限流
  │  └─ config.py                  # 設定（env 解析、publicOnly）
  └─ tests/
     ├─ test_prices_api.py         # API 測試
     ├─ test_arbitrage_engine.py   # 引擎單元/整合
     └─ test_exchanges.py          # 交易所封裝
```

### 9.3 抽象與介面（關鍵類）
- BaseExchange（抽象）
  - `async get_orderbook(symbol) -> OrderBook`
  - `async get_ticker(symbol) -> Ticker`
  - `async place_order(order: Order) -> PlaceOrderResult`
  - `async cancel_order(id) -> CancelResult`
  - `async get_balance() -> Balance`
  - `properties`: `name`, `public_only`
- ArbitrageEngine
  - `async monitor_pairs(pairs: list[PairConfig])`
  - `async detect_opportunity(pair: PairConfig) -> Opportunity | None`
  - `async execute_legs(leg1: Order, leg2: Order) -> ExecutionResult`
  - TWAP：`async run_twap(plan: TwapPlan) -> TwapProgress`
- CacheManager（TTL）
  - `get/set/expire`，動態 TTL（依波動/命中率）
- PerformanceMonitor
  - 記錄 `api_response_ms/arbitrage_ms/error_rate/cache_hit`

### 9.4 資料模型（pydantic 摘要）
- PairConfig：`id, leg1{exchange,symbol,type}, leg2{...}, threshold, qty, totalAmount, direction, enabled`
- Order：`symbol, side, type, qty, price (optional), exchange`
- OrderBook：`bids[(p,qty)], asks[(p,qty)], ts`
- Opportunity：`pairId, spread, spreadPct, leg1Price, leg2Price, ts`
- TwapPlan：`totalQty, sliceQty, intervalMs, legs[OrderTemplate]`

### 9.5 API 映射（與現有前端保持相容）
- GET `/api/prices/{exchange}/{symbol}` → `routes_prices.get_orderbook()`
- POST `/api/prices/batch` → `routes_prices.batch_orderbooks()`
- GET `/api/monitoring/pairs`/POST 新增/PUT/DELETE → `routes_monitoring`
- POST `/api/arbitrage/execute/{pairId}` → `routes_arbitrage.execute_pair()`
- TWAP `/api/twap/*` → 計畫 CRUD 與控制（開始/暫停/取消）
- Settings `/api/settings/api` → 僅後端保存金鑰與測試；無 `.env` 也需 graceful

回應格式維持：`{ success: boolean, data?: T, error?: { code, message } }`

### 9.6 併發、排程與風控
- 併發模型
  - 定時輪詢監控：`asyncio.create_task()` 啟動監控協程，對每個 `pairId` 維持一個任務
  - 高併發下單：`asyncio.TaskGroup` 並發兩腿，超時與取消控制
- 限流與重試
  - httpx 客戶端統一加 `Retry`（指數退避、HTTP 429/5xx 重試）
  - 交易所層級節流器（每窗口最大請求數）
- 風險控制
  - 下單前驗證：滑點檢查、價差再驗證、資金/額度/持倉限制
  - 熔斷：連續失敗次數/錯誤率超閾值 → 暫停該 pair 任務、告警
  - 觀察窗：使用移動平均與 PnL 限制，觸發自動暫停

### 9.7 事件與 WebSocket
- 事件類型：`price_update`、`opportunity`、`order_submitted`、`order_filled`、`order_failed`、`twap_progress`、`engine_alert`
- 前端通道：FastAPI `WebSocket` 路由 `/ws`
- 後端廣播：訂閱制（每個 session 訂閱對應 pair/exchange）

### 9.8 錯誤處理與日誌
- 統一錯誤：`TradingError(code, message, details)` → API 序列化為 `error{ code, message }`
- 日誌欄位：`event, exchange, pairId, symbol, latency_ms, success, error_code`
- 僅記錄關鍵業務事件與錯誤，遵守降噪原則

### 9.9 遷移計畫（Node → Python）
- 第 1 階段（並行運行，零停機）
  - Python 後端先實作 `/api/prices*` 與 `/api/monitoring*`（讀取路徑），端口 7000
  - 前端以設定切換 API 基址指向 Python，驗證相容格式
- 第 2 階段（策略與下單）
  - 實作 `/api/arbitrage/*` 與 TWAP，灰度切流（按 pairId 分組）
  - 接手引擎任務與 WS 事件；驗證風控與延遲
- 第 3 階段（退役 Node 路徑）
  - 刪除或關閉對應 Node 路由；保留監控只讀通道以觀測

風險緩解：雙寫/雙讀比對、金鑰與資金僅在活躍路徑生效、防止重複下單

### 9.10 測試與驗收
- 單元測試：`pytest`（引擎計算、風控校驗、DTO 驗證）
- 整合測試：`pytest-asyncio` + `httpx.AsyncClient` 測 REST/WS
- 實測：對接真實 Bybit/Binance 公開端點，使用少量請求與節流
- 驗收指標
  - API 響應：P95 < 200ms；引擎檢測 < 100ms
  - 成功率：> 99%；錯誤率 < 1%
  - 緩存命中率：> 80%；WS 事件延遲 < 100ms

### 9.11 部署與運維
- 啟動：`uvicorn app.main:app --host 0.0.0.0 --port 7000 --reload`（開發）
- 生產：多 workers（注意 asyncio IO 密集，優先水平擴展），前置 Nginx 反代與 TLS
- 監控：`/health`、結合 Prometheus FastAPI exporter、結構化日誌收集（ELK）

### 9.12 安全與環境
- 環境變數：僅後端讀取，前端不暴露；無 `.env` 也需 graceful（publicOnly）
- 權限：API Key 權限最小化，僅必要的交易/查詢範圍
- 輸入驗證：所有 API 請求使用 pydantic 模型校驗

### 9.13 與前端相容性要求
- 路由與回應格式保持不變
- 錯誤格式一致：`{ success:false, error:{ code, message } }`
- WS 事件名稱不變，欄位命名遵循現有前端解析

---

## 十、前後端 API 約定與 JSON 規格（REST + WebSocket）

### 10.1 通用回應包裹（Envelope）
- 成功：
```json
{
  "success": true,
  "data": { ... }
}
```
- 失敗：
```json
{
  "success": false,
  "error": { "code": "STRING_CODE", "message": "描述訊息" }
}
```
- 常見錯誤碼：
  - `VALIDATION_ERROR`、`NOT_FOUND`、`RATE_LIMITED`、`UPSTREAM_ERROR`、`INSUFFICIENT_FUNDS`、`RISK_REJECTED`、`EXCHANGE_UNAVAILABLE`

### 10.2 價格與訂單簿
- GET `/api/prices/:exchange/:symbol`
  - 回應：
```json
{
  "success": true,
  "data": {
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "bids": [["68000.1", "0.5"], ["68000.0", "0.8"]],
    "asks": [["68000.2", "0.3"], ["68000.3", "0.7"]],
    "ts": 1726032000123
  }
}
```
- POST `/api/prices/batch`
  - 請求：
```json
{
  "items": [
    { "exchange": "bybit", "symbol": "BTCUSDT" },
    { "exchange": "binance", "symbol": "ETHUSDT" }
  ]
}
```
  - 回應：
```json
{
  "success": true,
  "data": [
    { "exchange": "bybit", "symbol": "BTCUSDT", "bids": [["68000", "0.2"]], "asks": [["68000.5", "0.1"]], "ts": 1726032001000 },
    { "exchange": "binance", "symbol": "ETHUSDT", "bids": [["3500", "2"]], "asks": [["3500.2", "1"]], "ts": 1726032001005 }
  ]
}
```

### 10.3 監控交易對（Pairs）
- GET `/api/monitoring/pairs`
  - 回應：
```json
{
  "success": true,
  "data": [
    {
      "id": "bybit_binance_btc",
      "leg1": { "exchange": "bybit", "symbol": "BTCUSDT", "type": "linear" },
      "leg2": { "exchange": "binance", "symbol": "BTCUSDT", "type": "spot" },
      "threshold": 0.1,
      "qty": 0.001,
      "totalAmount": 200,
      "direction": "auto",
      "enabled": true
    }
  ]
}
```
- POST `/api/monitoring/pairs`
  - 請求：
```json
{
  "leg1": { "exchange": "bybit", "symbol": "BTCUSDT", "type": "linear" },
  "leg2": { "exchange": "binance", "symbol": "BTCUSDT", "type": "spot" },
  "threshold": 0.12,
  "qty": 0.001,
  "totalAmount": 300,
  "direction": "auto",
  "enabled": true
}
```
  - 回應：`{ "success": true, "data": { "id": "bybit_binance_btc" } }`
- PUT `/api/monitoring/pairs/:id` 同上結構；DELETE 無 body，成功回 `{ "success": true }`

### 10.4 套利執行與結果
- POST `/api/arbitrage/execute/:pairId`
  - 回應：
```json
{
  "success": true,
  "data": {
    "pairId": "bybit_binance_btc",
    "leg1": { "exchange": "bybit", "orderId": "A123", "success": true, "price": 68000.1, "qty": 0.001 },
    "leg2": { "exchange": "binance", "orderId": "B456", "success": true, "price": 68000.5, "qty": 0.001 },
    "spread": 0.4,
    "spreadPercent": 0.00059,
    "pnl": 0.2,
    "ts": 1726032003000
  }
}
```
  - 失敗示例：
```json
{
  "success": false,
  "error": { "code": "RISK_REJECTED", "message": "滑點超出上限" }
}
```

### 10.5 TWAP 策略
- POST `/api/twap/plans`
  - 請求：
```json
{
  "name": "BTC_TWAP",
  "totalQty": 0.01,
  "sliceQty": 0.001,
  "intervalMs": 30000,
  "legs": [
    { "exchange": "bybit", "symbol": "BTCUSDT", "side": "buy", "type": "market" },
    { "exchange": "binance", "symbol": "BTCUSDT", "side": "sell", "type": "market" }
  ]
}
```
  - 回應：`{ "success": true, "data": { "planId": "twap_001" } }`
- GET `/api/twap/:planId/status`
```json
{
  "success": true,
  "data": {
    "planId": "twap_001",
    "progress": { "executed": 0.004, "remaining": 0.006, "slicesDone": 4, "slicesTotal": 10 },
    "state": "running",
    "lastExecutionTs": 1726032005000
  }
}
```
- POST `/api/twap/:planId/control`
  - 請求：`{ "action": "pause" } | { "action": "resume" } | { "action": "cancel" }`
  - 回應：`{ "success": true }`

### 10.6 設定與狀態
- GET `/api/settings/api`
```json
{ "success": true, "data": { "bybit": { "connected": false }, "binance": { "connected": true } } }
```
- PUT `/api/settings/api`
  - 請求：`{ "binance": { "apiKey": "***", "secret": "***" } }`
  - 回應：`{ "success": true }`
- POST `/api/settings/api/test`
  - 回應：`{ "success": true, "data": { "connected": true } }`（不外洩金鑰）
- GET `/api/exchanges`
```json
{
  "success": true,
  "data": [
    { "name": "bybit", "connected": true, "publicOnly": true },
    { "name": "binance", "connected": true, "publicOnly": false }
  ]
}
```
- GET `/api/account/:exchange`
```json
{
  "success": true,
  "data": { "balances": [{ "asset": "USDT", "free": 1000.0 }], "positions": [] }
}
```

### 10.7 WebSocket 事件負載
- 連線：`/ws`
- 訊息包：
```json
{
  "event": "price_update",
  "data": { "exchange": "bybit", "symbol": "BTCUSDT", "bid": 68000.1, "ask": 68000.2, "ts": 1726032001200 }
}
```
- 事件類型與範例：
  - `opportunity`
```json
{ "event": "opportunity", "data": { "pairId": "bybit_binance_btc", "spread": 0.5, "spreadPercent": 0.0007, "ts": 1726032001300 } }
```
  - `order_submitted`
```json
{ "event": "order_submitted", "data": { "exchange": "binance", "orderId": "B456", "symbol": "BTCUSDT", "side": "sell", "qty": 0.001, "ts": 1726032001400 } }
```
  - `order_filled`
```json
{ "event": "order_filled", "data": { "exchange": "bybit", "orderId": "A123", "price": 68000.1, "qty": 0.001, "ts": 1726032001500 } }
```
  - `order_failed`
```json
{ "event": "order_failed", "data": { "exchange": "binance", "orderId": "B456", "code": "UPSTREAM_ERROR", "message": "Order rejected", "ts": 1726032001550 } }
```
  - `twap_progress`
```json
{ "event": "twap_progress", "data": { "planId": "twap_001", "executed": 0.004, "remaining": 0.006, "slicesDone": 4, "slicesTotal": 10, "state": "running", "ts": 1726032001600 } }
```
  - `engine_alert`
```json
{ "event": "engine_alert", "data": { "severity": "warning", "code": "RISK_REJECTED", "message": "滑點超出上限", "pairId": "bybit_binance_btc", "ts": 1726032001700 } }
```

### 10.8 類型說明（摘要）
- `exchange`: `"bybit" | "binance" | "okx" | "bitget"`
- `side`: `"buy" | "sell"`；`type`: `"market" | "limit"`
- 數字欄位以 number 回傳；若需高精度，字串傳遞但前端需轉型（目前訂單簿價格/數量使用字串以避免精度損失）
