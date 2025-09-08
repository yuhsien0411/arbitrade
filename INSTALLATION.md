# 🚀 雙腿套利交易系統 - 安裝指南

## 系統概述

這是一個參考 Taoli Tools 設計理念開發的專業加密貨幣雙腿套利交易系統，主要功能包括：

- **🔄 雙腿套利**：跨交易所價差監控和自動執行
- **⏰ TWAP策略**：時間加權平均價格執行
- **📊 即時監控**：bid1/ask1 價格監控和分析
- **🛡️ 風險控制**：完善的風險管理機制

## 系統要求

### 最低配置
- **操作系統**：Windows 10/11, macOS 10.15+, Ubuntu 18.04+
- **Node.js**：版本 16.0.0 或更高
- **內存**：至少 4GB RAM
- **硬盤**：至少 2GB 可用空間

### 推薦配置
- **CPU**：4核心或更高
- **內存**：8GB RAM 或更高
- **網路**：穩定的網路連接（低延遲）

## 快速開始

### 1. 克隆項目
```bash
git clone <repository-url>
cd arbi
```

### 2. 安裝依賴
```bash
# 安裝所有依賴（根目錄、服務端、客戶端）
npm run install:all

# 或者分別安裝
npm install
cd server && npm install
cd ../client && npm install
```

### 3. 環境配置

複製服務端環境配置文件：
```bash
cd server
cp env.example .env
```

編輯 `.env` 文件，配置必要的參數：
```env
# 服務器配置
PORT=5000
NODE_ENV=development

# Bybit API配置 (必須)
BYBIT_API_KEY=your_bybit_api_key
BYBIT_SECRET=your_bybit_secret
BYBIT_TESTNET=true

# 風險控制配置
MAX_POSITION_SIZE=10000
MAX_DAILY_LOSS=1000
PRICE_DEVIATION_THRESHOLD=0.05
```

### 4. 啟動系統
```bash
# 開發模式（同時啟動前後端）
npm run dev

# 或者分別啟動
npm run server:dev  # 啟動後端服務
npm run client:dev  # 啟動前端應用
```

### 5. 訪問系統
- **前端界面**：http://localhost:3000
- **後端API**：http://localhost:5000
- **健康檢查**：http://localhost:5000/health

## 詳細安裝步驟

### Node.js 安裝

#### Windows
1. 訪問 [Node.js官網](https://nodejs.org/)
2. 下載 LTS 版本
3. 運行安裝程序
4. 驗證安裝：
```cmd
node --version
npm --version
```

#### macOS
使用 Homebrew：
```bash
brew install node
```

#### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 項目依賴安裝

#### 根目錄依賴
```bash
npm install
```

#### 服務端依賴
```bash
cd server
npm install
```
主要依賴：
- `express` - Web框架
- `ccxt` - 交易所API庫
- `ws` - WebSocket支持
- `winston` - 日誌系統

#### 客戶端依賴
```bash
cd client
npm install
```
主要依賴：
- `react` - 前端框架
- `antd` - UI組件庫
- `redux-toolkit` - 狀態管理
- `socket.io-client` - WebSocket客戶端

## API 配置

### Bybit API 設置

1. **註冊 Bybit 帳戶**
   - 訪問 [Bybit官網](https://www.bybit.com/)
   - 完成註冊和實名認證

2. **創建 API 密鑰**
   - 登入 Bybit 帳戶
   - 前往「API管理」
   - 創建新的API密鑰
   - **重要**：建議使用子帳戶API，並設置IP白名單

3. **API 權限設置**
   - ✅ 讀取權限
   - ✅ 交易權限
   - ❌ 提取權限（不建議開啟）

4. **配置到系統**
   ```env
   BYBIT_API_KEY=your_api_key_here
   BYBIT_SECRET=your_secret_key_here
   BYBIT_TESTNET=true  # 測試環境，正式交易請改為false
   ```

### 其他交易所（即將支持）
- Binance
- OKX  
- Bitget

## 啟動選項

### 開發模式
```bash
npm run dev
```
- 自動重載
- 詳細日誌
- 錯誤調試信息

### 生產模式
```bash
npm run build
npm start
```
- 優化性能
- 壓縮資源
- 生產級日誌

## 常見問題

### Q: 無法連接到交易所API
**A:** 檢查以下項目：
1. API密鑰是否正確配置
2. 網路連接是否穩定
3. 是否在測試網環境
4. IP是否在白名單中

### Q: 前端無法連接後端
**A:** 確認：
1. 後端服務是否正常啟動
2. 端口5000是否被占用
3. 防火牆是否阻擋連接

### Q: WebSocket連接失敗
**A:** 檢查：
1. 瀏覽器是否支持WebSocket
2. 網路代理設置
3. 後端WebSocket服務是否啟動

### Q: 套利機會不觸發
**A:** 確認：
1. 監控交易對是否正確配置
2. 觸發閾值是否合理
3. 交易所API是否正常響應
4. 是否有足夠的資金餘額

## 系統監控

### 日誌文件位置
```
server/logs/
├── app.log          # 應用日誌
├── error.log        # 錯誤日誌
├── trading.log      # 交易日誌
└── combined.log     # 綜合日誌
```

### 健康檢查端點
```bash
curl http://localhost:5000/health
```

### 系統狀態監控
- 前端儀表板：即時查看系統狀態
- API端點：`GET /api/status`
- WebSocket：即時狀態推送

## 安全建議

### API 安全
1. **使用子帳戶**：避免使用主帳戶API
2. **設置IP白名單**：限制API訪問來源
3. **最小權限原則**：只開啟必要的API權限
4. **定期更換密鑰**：建議每月更換API密鑰

### 系統安全
1. **防火牆設置**：只開放必要端口
2. **SSL證書**：生產環境使用HTTPS
3. **定期更新**：保持系統和依賴項最新
4. **監控日誌**：定期檢查異常活動

## 性能優化

### 服務端優化
1. **連接池管理**：合理設置數據庫連接池
2. **緩存策略**：使用Redis緩存熱點數據
3. **負載均衡**：多實例部署
4. **監控告警**：設置性能監控

### 客戶端優化
1. **代碼分割**：按需加載組件
2. **緩存策略**：合理使用瀏覽器緩存
3. **壓縮資源**：啟用gzip壓縮
4. **CDN加速**：使用CDN加速靜態資源

## 下一步

安裝完成後，建議：

1. **📖 閱讀用戶手冊**：了解系統功能和操作方法
2. **🧪 測試環境驗證**：在測試網進行功能驗證
3. **⚙️ 配置監控對**：添加你感興趣的交易對
4. **🎯 設置風險參數**：根據風險承受能力調整參數
5. **📊 監控系統狀態**：定期檢查系統運行狀況

## 技術支持

如遇到問題，請：
1. 查看日誌文件
2. 檢查系統狀態
3. 參考常見問題
4. 聯繫技術支持

---

**⚠️ 風險提示**：加密貨幣交易存在高風險，請謹慎操作，合理控制倉位。
