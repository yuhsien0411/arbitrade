# 📁 Arbitrade 項目結構說明

本文檔詳細說明了 Arbitrade 加密貨幣套利交易系統的代碼組織結構和各模塊功能。

## 🏗️ 整體架構

```
D:\arbi\                          # 項目根目錄
├── 📁 client/                    # 前端應用 (React)
├── 📁 server/                    # 後端應用 (Node.js)
├── 📄 package.json               # 項目配置和腳本
├── 📄 README.md                  # 項目說明文檔
├── 📄 PROJECT_STRUCTURE.md       # 項目結構說明 (本文檔)
└── 📄 INSTALLATION.md            # 安裝部署指南
```

---

## 🎨 前端結構 (`client/`)

### 📋 目錄概覽

```
client/
├── 📁 public/                    # 靜態資源
│   ├── 📄 index.html             # HTML 模板
│   └── 📄 favicon.ico            # 網站圖標
├── 📁 src/                       # 源代碼
│   ├── 📁 components/            # 可複用組件
│   ├── 📁 pages/                 # 頁面組件
│   ├── 📁 services/              # 服務層
│   ├── 📁 store/                 # 狀態管理
│   ├── 📁 utils/                 # 工具函數
│   ├── 📄 App.tsx                # 主應用組件
│   ├── 📄 index.tsx              # 應用入口
│   └── 📄 index.css              # 全局樣式
├── 📄 package.json               # 前端依賴配置
└── 📄 tsconfig.json              # TypeScript 配置
```

### 🧩 核心模塊詳解

#### 📁 `src/components/` - 通用組件
```
components/
├── 📄 AppHeader.tsx              # 應用頂部導航欄
│   ├── 🔹 品牌標識 (Arbitrade)
│   ├── 🔹 連接狀態顯示
│   ├── 🔹 通知中心
│   └── 🔹 設置入口
└── 📄 AppSider.tsx               # 側邊欄導航
    ├── 🔹 功能模塊導航
    ├── 🔹 監控儀表板
    ├── 🔹 雙腿套利
    ├── 🔹 TWAP策略
    └── 🔹 系統設置
```

#### 📁 `src/pages/` - 頁面組件
```
pages/
├── 📄 Dashboard.tsx              # 監控儀表板
│   ├── 🔹 系統狀態總覽
│   ├── 🔹 交易統計卡片
│   ├── 🔹 即時套利機會
│   └── 🔹 交易執行狀態
├── 📄 ArbitragePage.tsx          # 雙腿套利頁面
│   ├── 🔹 監控配置表單
│   ├── 🔹 交易對選擇 (Leg1 + Leg2)
│   ├── 🔹 價差閾值設定
│   ├── 🔹 監控列表管理
│   └── 🔹 一鍵手動執行
├── 📄 TwapPage.tsx               # TWAP策略頁面
│   ├── 🔹 雙腿TWAP配置
│   ├── 🔹 策略參數設定
│   ├── 🔹 執行進度監控
│   ├── 🔹 歷史執行記錄
│   └── 🔹 策略管理 (暫停/恢復/取消)
└── 📄 SettingsPage.tsx           # 系統設置頁面
    ├── 🔹 API密鑰管理
    ├── 🔹 風險控制參數
    ├── 🔹 連接測試功能
    └── 🔹 系統信息顯示
```

#### 📁 `src/services/` - 服務層
```
services/
├── 📄 api.ts                     # API 服務封裝
│   ├── 🔹 HTTP 請求配置
│   ├── 🔹 API 端點定義
│   ├── 🔹 請求/響應攔截器
│   └── 🔹 錯誤處理機制
└── 📄 websocket.ts               # WebSocket 服務
    ├── 🔹 實時數據連接
    ├── 🔹 消息處理分發
    ├── 🔹 連接狀態管理
    └── 🔹 自動重連機制
```

#### 📁 `src/store/` - 狀態管理 (Redux)
```
store/
├── 📄 index.ts                   # Store 配置
├── 📁 slices/                    # Redux Slices
│   ├── 📄 systemSlice.ts         # 系統狀態
│   │   ├── 🔹 連接狀態
│   │   ├── 🔹 交易所信息
│   │   ├── 🔹 通知管理
│   │   └── 🔹 風險控制參數
│   ├── 📄 arbitrageSlice.ts      # 套利狀態
│   │   ├── 🔹 監控配置列表
│   │   ├── 🔹 套利機會記錄
│   │   └── 🔹 交易執行狀態
│   ├── 📄 twapSlice.ts           # TWAP狀態
│   │   ├── 🔹 策略配置列表
│   │   ├── 🔹 執行進度追蹤
│   │   └── 🔹 歷史執行記錄
│   └── 📄 pricesSlice.ts         # 價格數據
│       ├── 🔹 實時價格緩存
│       ├── 🔹 價差計算
│       └── 🔹 歷史價格數據
```

---

## ⚙️ 後端結構 (`server/`)

### 📋 目錄概覽

```
server/
├── 📁 config/                    # 配置文件
├── 📁 routes/                    # 路由定義
├── 📁 services/                  # 業務邏輯服務
├── 📁 utils/                     # 工具函數
├── 📁 websocket/                 # WebSocket 處理
├── 📄 index.js                   # 服務器入口
├── 📄 package.json               # 後端依賴配置
├── 📄 .env                       # 環境變量 (不納入版控)
└── 📄 .example.env               # 環境變量模板
```

### 🔧 核心模塊詳解

#### 📄 `index.js` - 服務器主入口
```javascript
主要功能：
├── 🔹 Express 應用初始化
├── 🔹 中間件配置 (CORS、安全、壓縮)
├── 🔹 API 路由註冊
├── 🔹 WebSocket 服務器設置
├── 🔹 交易服務初始化 (Bybit)
├── 🔹 錯誤處理中間件
└── 🔹 服務器啟動邏輯
```

#### 📁 `services/` - 業務服務層
```
services/
├── 📄 bybitService.js            # Bybit 交易所服務
│   ├── 🔹 官方 SDK 集成
│   ├── 🔹 API 客戶端初始化
│   ├── 🔹 賬戶信息查詢
│   ├── 🔹 訂單簿數據獲取
│   ├── 🔹 交易執行功能
│   ├── 🔹 WebSocket 數據訂閱
│   └── 🔹 連接狀態管理
├── 📄 arbitrageEngine.js         # 套利引擎
│   ├── 🔹 價差計算邏輯
│   ├── 🔹 套利機會檢測
│   ├── 🔹 雙腿訂單執行
│   ├── 🔹 風險控制檢查
│   └── 🔹 執行狀態追蹤
└── 📄 twapEngine.js              # TWAP 執行引擎 (計劃中)
    ├── 🔹 訂單分割算法
    ├── 🔹 時間間隔控制
    ├── 🔹 執行進度管理
    └── 🔹 雙腿同步執行
```

#### 📁 `routes/` - API 路由
```
routes/
└── 📄 api.js                     # API 路由定義
    ├── 🔹 /api/exchanges         # 交易所信息
    ├── 🔹 /api/monitoring/pairs  # 監控配置
    ├── 🔹 /api/twap/strategies   # TWAP 策略
    ├── 🔹 /api/settings/api      # API 設定
    ├── 🔹 /api/account/:exchange # 賬戶信息
    ├── 🔹 /api/orderbook/:symbol # 訂單簿數據
    └── 🔹 /api/order/:exchange   # 交易執行
```

#### 📁 `config/` - 配置管理
```
config/
└── 📄 database.js                # 數據庫配置 (暫未使用)
    ├── 🔹 MongoDB 連接設定
    ├── 🔹 Redis 緩存配置
    └── 🔹 連接池管理
```

#### 📁 `utils/` - 工具函數
```
utils/
└── 📄 logger.js                  # 日誌工具
    ├── 🔹 控制台日誌輸出
    ├── 🔹 日誌級別控制
    └── 🔹 錯誤追蹤
```

#### 📁 `websocket/` - WebSocket 處理
```
websocket/
└── 📄 handler.js                 # WebSocket 消息處理
    ├── 🔹 客戶端連接管理
    ├── 🔹 實時數據推送
    ├── 🔹 消息路由分發
    └── 🔹 連接狀態維護
```

---

## 🔗 數據流向圖

```
┌─────────────────┐    WebSocket     ┌─────────────────┐    REST API    ┌─────────────────┐
│   前端界面      │◄──────────────────┤   後端服務器    │◄──────────────►│   交易所 API    │
│   React App     │    即時數據推送   │   Express       │    交易執行    │   Bybit SDK     │
└─────────────────┘                  └─────────────────┘                └─────────────────┘
         ▲                                      ▲
         │                                      │
         ▼                                      ▼
┌─────────────────┐                  ┌─────────────────┐
│   Redux Store   │                  │   業務邏輯層    │
│   狀態管理      │                  │   套利引擎      │
└─────────────────┘                  └─────────────────┘
```

## 📊 技術棧對應

### 前端技術棧
| 技術 | 用途 | 對應文件 |
|------|------|----------|
| **React 18** | 用戶界面框架 | `src/components/`, `src/pages/` |
| **TypeScript** | 類型安全 | 所有 `.tsx`, `.ts` 文件 |
| **Redux Toolkit** | 狀態管理 | `src/store/` |
| **Ant Design** | UI 組件庫 | 各頁面組件中使用 |
| **Axios** | HTTP 請求 | `src/services/api.ts` |
| **WebSocket** | 實時通訊 | `src/services/websocket.ts` |

### 後端技術棧
| 技術 | 用途 | 對應文件 |
|------|------|----------|
| **Node.js** | 運行環境 | 整個 `server/` 目錄 |
| **Express** | Web 框架 | `index.js`, `routes/` |
| **WebSocket** | 實時通訊 | `websocket/handler.js` |
| **Bybit SDK** | 交易所集成 | `services/bybitService.js` |
| **dotenv** | 環境配置 | `.env`, `.example.env` |

## 🔐 安全考量

### 環境變量管理
```
.env 文件結構：
├── 🔹 BYBIT_API_KEY         # Bybit API 密鑰
├── 🔹 BYBIT_SECRET          # Bybit 密鑰
├── 🔹 BYBIT_TESTNET         # 測試網開關 (固定為 false)
├── 🔹 PORT                  # 服務器端口
└── 🔹 NODE_ENV              # 運行環境
```

### API 密鑰處理
- ✅ 環境變量存儲
- ✅ 前端遮罩顯示
- ✅ HTTPS 傳輸加密
- ❌ 本地加密存儲 (待開發)

## 📈 擴展規劃

### 即將新增的目錄結構
```
server/
├── 📁 models/                    # 數據模型 (計劃中)
├── 📁 middleware/                # 中間件 (計劃中)
├── 📁 tests/                     # 測試文件 (計劃中)
└── 📁 docs/                      # API 文檔 (計劃中)

client/
├── 📁 hooks/                     # 自定義 Hooks (計劃中)
├── 📁 types/                     # TypeScript 類型 (計劃中)
└── 📁 tests/                     # 前端測試 (計劃中)
```

## 🛠️ 開發工作流

### 添加新功能的步驟
1. **後端開發**：
   ```
   services/ → routes/ → index.js → 測試
   ```

2. **前端開發**：
   ```
   store/slices/ → services/ → pages/ → components/ → 測試
   ```

3. **集成測試**：
   ```
   API 測試 → WebSocket 測試 → 端到端測試
   ```

## 📚 相關文檔

- 📄 [README.md](./README.md) - 項目總體說明
- 📄 [INSTALLATION.md](./INSTALLATION.md) - 安裝部署指南
- 📄 [API.md](./docs/API.md) - API 接口文檔 (計劃中)
- 📄 [CONTRIBUTING.md](./CONTRIBUTING.md) - 貢獻指南 (計劃中)

---

**📝 說明**：本文檔會隨著項目發展持續更新，確保準確反映最新的代碼結構。

**🔄 最後更新**：2024年 - Arbitrade v1.0.0
