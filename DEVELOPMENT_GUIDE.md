# 🚀 Arbitrade 後端開發指南

## 📋 目錄
- [項目概述](#項目概述)
- [開發環境設置](#開發環境設置)
- [架構設計](#架構設計)
- [核心模組說明](#核心模組說明)
- [API 接口文檔](#api-接口文檔)
- [數據庫設計](#數據庫設計)
- [交易所集成](#交易所集成)
- [部署指南](#部署指南)
- [測試指南](#測試指南)
- [故障排除](#故障排除)

## 🎯 項目概述

Arbitrade 是一個專業的加密貨幣套利交易平台，支持跨交易所的差價套利和 TWAP 執行策略。本指南將幫助開發者理解系統架構、快速上手開發，並提供完整的技術文檔。

### 核心功能
- **多交易所支持**：Bybit、Binance、OKX、Bitget
- **雙腿套利**：跨交易所價差套利
- **TWAP 策略**：時間加權平均價格執行
- **實時監控**：WebSocket 即時數據推送
- **風險控制**：完善的風險管理機制

## 🛠️ 開發環境設置

### 系統要求
- Node.js >= 18.0.0
- MongoDB >= 5.0
- Redis >= 6.0
- npm >= 8.0.0

### 安裝步驟

1. **克隆項目**
```bash
git clone <repository-url>
cd arbitrade
```

2. **安裝依賴**
```bash
# 安裝後端依賴
cd server
npm install

# 安裝前端依賴
cd ../client
npm install
```

3. **環境配置**
```bash
# 複製環境變量模板
cp .env.example .env

# 編輯環境變量
nano .env
```

4. **數據庫設置**
```bash
# 啟動 MongoDB
sudo systemctl start mongod

# 啟動 Redis
sudo systemctl start redis
```

5. **啟動開發服務器**
```bash
# 啟動後端服務器
cd server
npm run dev

# 啟動前端服務器（新終端）
cd client
npm start
```

### 環境變量配置

```bash
# 服務器配置
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# 數據庫配置
MONGODB_URI=mongodb://localhost:27017/arbitrade
REDIS_URL=redis://localhost:6379

# 交易所 API 配置
BYBIT_API_KEY=your_bybit_api_key
BYBIT_SECRET=your_bybit_secret
BYBIT_TESTNET=false

BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret
BINANCE_TESTNET=false

OKX_API_KEY=your_okx_api_key
OKX_SECRET=your_okx_secret
OKX_PASSPHRASE=your_okx_passphrase
OKX_TESTNET=false

BITGET_API_KEY=your_bitget_api_key
BITGET_SECRET=your_bitget_secret
BITGET_PASSPHRASE=your_bitget_passphrase
BITGET_TESTNET=false

# 風險控制配置
MAX_POSITION_SIZE=10000
MAX_DAILY_LOSS=1000
PRICE_DEVIATION_THRESHOLD=0.05

# 日誌配置
LOG_LEVEL=info
LOG_WS_RAW=false
LOG_WS_TICKS=false
```

## 🏗️ 架構設計

### 系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                        前端層 (React)                        │
├─────────────────────────────────────────────────────────────┤
│                         API 層 (Express)                    │
├─────────────────────────────────────────────────────────────┤
│  業務邏輯層  │  套利引擎  │  交易執行  │  風險管理  │  通知服務  │
├─────────────────────────────────────────────────────────────┤
│  交易所適配層  │  Bybit  │  Binance  │  OKX  │  Bitget  │
├─────────────────────────────────────────────────────────────┤
│  數據存儲層  │  MongoDB  │  Redis  │  文件系統  │
└─────────────────────────────────────────────────────────────┘
```

### 模組關係圖

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   前端界面   │◄──►│   API 路由   │◄──►│  業務服務層  │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                   ┌─────────────┐    ┌─────────────┐
                   │  套利引擎    │◄──►│  交易執行層  │
                   └─────────────┘    └─────────────┘
                                              │
                   ┌─────────────┐    ┌─────────────┐
                   │  交易所工廠   │◄──►│  交易所適配  │
                   └─────────────┘    └─────────────┘
```

## 🔧 核心模組說明

### 1. 交易所適配層 (exchanges/)

#### BaseExchange 抽象類
```javascript
/**
 * 交易所基類 - 定義統一的交易所接口
 */
class BaseExchange {
  constructor(config) {
    this.config = config;
    this.restClient = null;
    this.wsClient = null;
    this.isConnected = false;
    this.tickerCache = new Map();
  }

  // 抽象方法 - 必須由子類實現
  async initialize() { throw new Error('Not implemented'); }
  async getAccountInfo() { throw new Error('Not implemented'); }
  async getOrderBook(symbol, category) { throw new Error('Not implemented'); }
  async placeOrder(orderParams) { throw new Error('Not implemented'); }
  async cancelOrder(symbol, orderId) { throw new Error('Not implemented'); }
  async subscribeToTickers(symbols) { throw new Error('Not implemented'); }
  
  // 通用方法
  isExchangeConnected() { return this.isConnected; }
  getExchangeName() { return this.config.name; }
  getTopOfBook(symbol) { return this.tickerCache.get(symbol) || null; }
}
```

#### 交易所工廠
```javascript
/**
 * 交易所工廠 - 統一創建交易所實例
 */
class ExchangeFactory {
  static exchanges = new Map();
  
  static createExchange(exchangeName, config) {
    if (this.exchanges.has(exchangeName)) {
      return this.exchanges.get(exchangeName);
    }
    
    let exchange;
    switch (exchangeName.toLowerCase()) {
      case 'bybit':
        exchange = new BybitExchange(config);
        break;
      case 'binance':
        exchange = new BinanceExchange(config);
        break;
      case 'okx':
        exchange = new OkxExchange(config);
        break;
      case 'bitget':
        exchange = new BitgetExchange(config);
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchangeName}`);
    }
    
    this.exchanges.set(exchangeName, exchange);
    return exchange;
  }
}
```

### 2. 套利引擎 (arbitrage/)

#### ArbitrageEngine 核心類
```javascript
/**
 * 套利引擎 - 核心套利邏輯
 */
class ArbitrageEngine extends EventEmitter {
  constructor() {
    super();
    this.monitoringPairs = new Map();
    this.activeStrategies = new Map();
    this.isRunning = false;
    this.priceUpdateInterval = 1000;
  }

  /**
   * 添加監控交易對
   */
  addMonitoringPair(config) {
    const pairConfig = {
      id: config.id,
      leg1: config.leg1,
      leg2: config.leg2,
      threshold: parseFloat(config.threshold),
      amount: parseFloat(config.amount),
      enabled: config.enabled !== false,
      createdAt: Date.now(),
      lastTriggered: null,
      totalTriggers: 0
    };

    this.monitoringPairs.set(config.id, pairConfig);
    this.emit('pairAdded', pairConfig);
    return pairConfig;
  }

  /**
   * 檢查套利機會
   */
  async checkArbitrageOpportunities() {
    const opportunities = [];
    
    for (const [id, pairConfig] of this.monitoringPairs) {
      if (!pairConfig.enabled) continue;
      
      try {
        const opportunity = await this.analyzePairSpread(pairConfig);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      } catch (error) {
        logger.error(`分析交易對 ${id} 時發生錯誤:`, error);
      }
    }
    
    if (opportunities.length > 0) {
      this.emit('opportunitiesFound', opportunities);
    }
  }
}
```

### 3. 交易執行層 (trading/)

#### OrderService 訂單服務
```javascript
/**
 * 訂單服務 - 統一訂單管理
 */
class OrderService {
  constructor() {
    this.activeOrders = new Map();
    this.orderHistory = [];
  }

  /**
   * 執行雙腿訂單
   */
  async executeDualLegOrder(leg1Order, leg2Order) {
    try {
      // 獲取交易所實例
      const leg1Exchange = ExchangeFactory.createExchange(leg1Order.exchange);
      const leg2Exchange = ExchangeFactory.createExchange(leg2Order.exchange);
      
      // 同時執行兩個訂單
      const [leg1Result, leg2Result] = await Promise.all([
        leg1Exchange.placeOrder(leg1Order),
        leg2Exchange.placeOrder(leg2Order)
      ]);
      
      // 檢查執行結果
      if (!leg1Result.success || !leg2Result.success) {
        // 處理部分失敗的情況
        await this.handlePartialFailure(leg1Result, leg2Result);
      }
      
      return {
        success: leg1Result.success && leg2Result.success,
        leg1: leg1Result,
        leg2: leg2Result,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('雙腿訂單執行失敗:', error);
      throw error;
    }
  }
}
```

### 4. 風險管理 (trading/RiskManager.js)

```javascript
/**
 * 風險管理器 - 交易風險控制
 */
class RiskManager {
  constructor() {
    this.riskLimits = {
      maxPositionSize: 10000,
      maxDailyLoss: 1000,
      priceDeviationThreshold: 0.05,
      maxConcurrentOrders: 10
    };
  }

  /**
   * 風險檢查
   */
  performRiskCheck(orderParams) {
    const checks = [];
    
    // 檢查單筆交易金額
    if (orderParams.amount > this.riskLimits.maxPositionSize) {
      checks.push({
        type: 'position_size',
        passed: false,
        message: `交易金額超過限制: ${orderParams.amount} > ${this.riskLimits.maxPositionSize}`
      });
    }
    
    // 檢查價格偏差
    if (orderParams.priceDeviation > this.riskLimits.priceDeviationThreshold) {
      checks.push({
        type: 'price_deviation',
        passed: false,
        message: `價格偏差過大: ${orderParams.priceDeviation} > ${this.riskLimits.priceDeviationThreshold}`
      });
    }
    
    return {
      passed: checks.every(check => check.passed),
      checks: checks
    };
  }
}
```

## 📡 API 接口文檔

### 1. 交易所管理 API

#### 獲取交易所狀態
```http
GET /api/exchanges
```

**響應示例：**
```json
{
  "success": true,
  "data": {
    "bybit": {
      "name": "Bybit",
      "connected": true,
      "supportCustomSymbol": true,
      "description": "支援用戶自行輸入任何可用的交易對"
    },
    "binance": {
      "name": "Binance",
      "connected": false,
      "comingSoon": true
    }
  }
}
```

#### 測試交易所連接
```http
GET /api/settings/api/test
```

**響應示例：**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "API連接和權限測試成功",
    "serverTime": 1703123456789,
    "platform": "真實平台 (非測試網)",
    "accountInfo": {
      "marginMode": "REGULAR_MARGIN",
      "marginModeText": "全倉保證金",
      "unifiedMarginStatus": 5,
      "unifiedMarginStatusText": "統一帳戶2.0"
    }
  }
}
```

### 2. 監控交易對 API

#### 獲取監控交易對列表
```http
GET /api/monitoring/pairs
```

#### 添加監控交易對
```http
POST /api/monitoring/pairs
Content-Type: application/json

{
  "leg1": {
    "exchange": "bybit",
    "symbol": "BTCUSDT",
    "type": "linear",
    "side": "buy"
  },
  "leg2": {
    "exchange": "bybit",
    "symbol": "BTCUSDT",
    "type": "spot",
    "side": "sell"
  },
  "threshold": 0.1,
  "amount": 50,
  "enabled": true
}
```

#### 獲取實時價格
```http
GET /api/monitoring/prices
```

**響應示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "1703123456789_BTCUSDT",
      "pairConfig": { /* 交易對配置 */ },
      "leg1Price": {
        "symbol": "BTCUSDT",
        "exchange": "bybit",
        "bid1": { "price": 43250.5, "amount": 1.2 },
        "ask1": { "price": 43251.0, "amount": 0.8 }
      },
      "leg2Price": {
        "symbol": "BTCUSDT",
        "exchange": "bybit",
        "bid1": { "price": 43248.0, "amount": 2.1 },
        "ask1": { "price": 43249.5, "amount": 1.5 }
      },
      "spread": 1.0,
      "spreadPercent": 0.0023,
      "threshold": 0.1,
      "shouldTrigger": false,
      "timestamp": 1703123456789,
      "direction": "leg1_sell_leg2_buy"
    }
  ]
}
```

### 3. 套利執行 API

#### 執行套利交易
```http
POST /api/arbitrage/execute/{pairId}
```

**響應示例：**
```json
{
  "success": true,
  "data": {
    "success": true,
    "pairId": "1703123456789_BTCUSDT",
    "executionTime": "2023-12-21T10:30:45.123Z",
    "leg1": {
      "exchange": "bybit",
      "symbol": "BTCUSDT",
      "side": "sell",
      "quantity": 50,
      "price": 43250.5,
      "orderId": "1234567890",
      "orderLinkId": "arbitrage_leg1_1703123456789"
    },
    "leg2": {
      "exchange": "bybit",
      "symbol": "BTCUSDT",
      "side": "buy",
      "quantity": 50,
      "price": 43249.5,
      "orderId": "1234567891",
      "orderLinkId": "arbitrage_leg2_1703123456789"
    },
    "spread": 1.0,
    "estimatedProfit": 50.0,
    "threshold": 0.1,
    "executionMode": "threshold",
    "timestamp": 1703123456789
  }
}
```

## 🗄️ 數據庫設計

### MongoDB 集合設計

#### 1. 交易對集合 (trading_pairs)
```javascript
{
  _id: ObjectId,
  id: String, // 唯一標識符
  leg1: {
    exchange: String, // 'bybit', 'binance', 'okx', 'bitget'
    symbol: String,   // 'BTCUSDT'
    type: String,     // 'spot', 'linear', 'inverse'
    side: String      // 'buy', 'sell'
  },
  leg2: {
    exchange: String,
    symbol: String,
    type: String,
    side: String
  },
  threshold: Number,    // 觸發閾值
  amount: Number,       // 交易數量
  enabled: Boolean,     // 是否啟用
  createdAt: Date,
  updatedAt: Date,
  lastTriggered: Date,
  totalTriggers: Number
}
```

#### 2. 訂單集合 (orders)
```javascript
{
  _id: ObjectId,
  orderId: String,      // 交易所訂單ID
  orderLinkId: String,  // 自定義訂單ID
  pairId: String,       // 關聯的交易對ID
  exchange: String,     // 交易所名稱
  symbol: String,       // 交易對
  side: String,         // 'buy', 'sell'
  type: String,         // 'market', 'limit'
  quantity: Number,     // 數量
  price: Number,        // 價格
  status: String,       // 'pending', 'filled', 'cancelled'
  leg: String,          // 'leg1', 'leg2'
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. 套利記錄集合 (arbitrage_records)
```javascript
{
  _id: ObjectId,
  pairId: String,       // 交易對ID
  executionTime: Date,  // 執行時間
  leg1Order: ObjectId,  // Leg1 訂單ID
  leg2Order: ObjectId,  // Leg2 訂單ID
  spread: Number,       // 價差
  spreadPercent: Number, // 價差百分比
  estimatedProfit: Number, // 預估利潤
  actualProfit: Number,    // 實際利潤
  status: String,          // 'success', 'partial', 'failed'
  createdAt: Date
}
```

### Redis 緩存設計

#### 1. 價格緩存
```
Key: price:{exchange}:{symbol}
Value: {
  "bid1": {"price": 43250.5, "amount": 1.2},
  "ask1": {"price": 43251.0, "amount": 0.8},
  "timestamp": 1703123456789
}
TTL: 60 seconds
```

#### 2. 會話緩存
```
Key: session:{userId}
Value: {
  "userId": "user123",
  "permissions": ["read", "write"],
  "lastActivity": 1703123456789
}
TTL: 24 hours
```

#### 3. 限流緩存
```
Key: rate_limit:{ip}:{endpoint}
Value: request_count
TTL: 1 minute
```

## 🔌 交易所集成

### Bybit 集成示例

```javascript
/**
 * Bybit 交易所適配器
 */
class BybitExchange extends BaseExchange {
  constructor(config) {
    super(config);
    this.restClient = null;
    this.wsClient = null;
  }

  async initialize() {
    try {
      const { RestClientV5, WebsocketClient } = require('bybit-api');
      
      this.restClient = new RestClientV5({
        key: this.config.apiKey,
        secret: this.config.secret,
        testnet: this.config.testnet || false
      });

      this.wsClient = new WebsocketClient({
        key: this.config.apiKey,
        secret: this.config.secret,
        market: 'v5',
        testnet: this.config.testnet || false
      });

      this.setupWebSocketHandlers();
      this.isConnected = true;
      
      logger.info('Bybit 交易所初始化成功');
      return true;
    } catch (error) {
      logger.error('Bybit 交易所初始化失敗:', error);
      return false;
    }
  }

  async getOrderBook(symbol, category = 'linear') {
    try {
      const response = await this.restClient.getOrderbook({
        category: category,
        symbol: symbol,
        limit: 25
      });

      return {
        success: true,
        data: response.result
      };
    } catch (error) {
      logger.error('獲取訂單簿失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async placeOrder(orderParams) {
    try {
      const {
        symbol,
        side,
        orderType = 'Market',
        qty,
        price,
        category = 'linear'
      } = orderParams;

      const orderData = {
        category: category,
        symbol: symbol,
        side: side,
        orderType: orderType,
        qty: qty.toString()
      };

      if (orderType === 'Limit' && price) {
        orderData.price = price.toString();
      }

      const response = await this.restClient.submitOrder(orderData);

      return {
        success: true,
        data: response.result
      };
    } catch (error) {
      logger.error('下單失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

### Binance 集成示例

```javascript
/**
 * Binance 交易所適配器
 */
class BinanceExchange extends BaseExchange {
  constructor(config) {
    super(config);
    this.restClient = null;
    this.wsClient = null;
  }

  async initialize() {
    try {
      const Binance = require('binance-api-node').default;
      
      this.restClient = Binance({
        apiKey: this.config.apiKey,
        apiSecret: this.config.secret,
        test: this.config.testnet || false
      });

      this.isConnected = true;
      logger.info('Binance 交易所初始化成功');
      return true;
    } catch (error) {
      logger.error('Binance 交易所初始化失敗:', error);
      return false;
    }
  }

  async getOrderBook(symbol, category = 'spot') {
    try {
      let response;
      if (category === 'spot') {
        response = await this.restClient.book({ symbol: symbol });
      } else {
        response = await this.restClient.futuresBook({ symbol: symbol });
      }

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('獲取訂單簿失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

## 🚀 部署指南

### Docker 部署

#### 1. 創建 Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製源代碼
COPY . .

# 暴露端口
EXPOSE 5000

# 啟動應用
CMD ["npm", "start"]
```

#### 2. 創建 docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/arbitrade
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    volumes:
      - ./logs:/app/logs

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=arbitrade

  redis:
    image: redis:6.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

#### 3. 部署命令
```bash
# 構建和啟動服務
docker-compose up -d

# 查看日誌
docker-compose logs -f app

# 停止服務
docker-compose down
```

### 生產環境部署

#### 1. 使用 PM2 部署
```bash
# 安裝 PM2
npm install -g pm2

# 創建 PM2 配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'arbitrade-server',
    script: 'index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# 啟動應用
pm2 start ecosystem.config.js

# 查看狀態
pm2 status

# 重啟應用
pm2 restart arbitrade-server
```

#### 2. Nginx 反向代理配置
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🧪 測試指南

### 單元測試

#### 1. 安裝測試依賴
```bash
npm install --save-dev jest supertest sinon
```

#### 2. 創建測試文件
```javascript
// tests/unit/exchanges/BybitExchange.test.js
const BybitExchange = require('../../../exchanges/bybit/BybitExchange');

describe('BybitExchange', () => {
  let exchange;
  
  beforeEach(() => {
    exchange = new BybitExchange({
      apiKey: 'test_key',
      secret: 'test_secret',
      testnet: true
    });
  });

  test('should initialize successfully', async () => {
    const result = await exchange.initialize();
    expect(result).toBe(true);
    expect(exchange.isExchangeConnected()).toBe(true);
  });

  test('should get order book', async () => {
    await exchange.initialize();
    const result = await exchange.getOrderBook('BTCUSDT', 'linear');
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

#### 3. 運行測試
```bash
# 運行所有測試
npm test

# 運行特定測試文件
npm test -- tests/unit/exchanges/BybitExchange.test.js

# 生成覆蓋率報告
npm run test:coverage
```

### 集成測試

```javascript
// tests/integration/api/monitoring.test.js
const request = require('supertest');
const app = require('../../../index');

describe('Monitoring API', () => {
  test('should get monitoring pairs', async () => {
    const response = await request(app)
      .get('/api/monitoring/pairs')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('should add monitoring pair', async () => {
    const pairConfig = {
      leg1: {
        exchange: 'bybit',
        symbol: 'BTCUSDT',
        type: 'linear',
        side: 'buy'
      },
      leg2: {
        exchange: 'bybit',
        symbol: 'BTCUSDT',
        type: 'spot',
        side: 'sell'
      },
      threshold: 0.1,
      amount: 50,
      enabled: true
    };

    const response = await request(app)
      .post('/api/monitoring/pairs')
      .send(pairConfig)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
  });
});
```

## 🔧 故障排除

### 常見問題

#### 1. WebSocket 連接失敗
**問題**：WebSocket 連接經常斷開
**解決方案**：
```javascript
// 添加重連機制
this.wsClient.on('close', () => {
  logger.warn('WebSocket 連接斷開，嘗試重連...');
  setTimeout(() => {
    this.initialize();
  }, 5000);
});
```

#### 2. API 限流問題
**問題**：API 請求被限流
**解決方案**：
```javascript
// 實現請求隊列
class RateLimiter {
  constructor(requests, window) {
    this.requests = requests;
    this.window = window;
    this.queue = [];
  }

  async execute(request) {
    return new Promise((resolve) => {
      this.queue.push({ request, resolve });
      this.processQueue();
    });
  }

  processQueue() {
    if (this.queue.length === 0) return;
    
    const now = Date.now();
    const recentRequests = this.queue.filter(
      item => now - item.timestamp < this.window
    );
    
    if (recentRequests.length < this.requests) {
      const item = this.queue.shift();
      item.timestamp = now;
      item.request().then(item.resolve);
    }
  }
}
```

#### 3. 數據庫連接問題
**問題**：MongoDB 連接超時
**解決方案**：
```javascript
// 添加連接重試機制
const connectWithRetry = async () => {
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB 連接成功');
  } catch (error) {
    logger.error('MongoDB 連接失敗，5秒後重試:', error);
    setTimeout(connectWithRetry, 5000);
  }
};
```

### 日誌分析

#### 1. 查看錯誤日誌
```bash
# 查看最近的錯誤
tail -f logs/error.log

# 搜索特定錯誤
grep "TradingError" logs/error.log

# 查看 WebSocket 相關日誌
grep "WS_" logs/combined.log
```

#### 2. 性能監控
```bash
# 監控內存使用
pm2 monit

# 查看 API 響應時間
grep "response_time" logs/access.log | tail -100
```

### 調試技巧

#### 1. 啟用調試模式
```bash
# 設置調試環境變量
export DEBUG=arbitrade:*
export LOG_WS_RAW=true
export LOG_WS_TICKS=true

# 啟動應用
npm run dev
```

#### 2. 使用斷點調試
```javascript
// 在 VS Code 中設置斷點
// 或使用 console.log 調試
console.log('調試信息:', {
  symbol: symbol,
  price: price,
  timestamp: Date.now()
});
```

## 📚 參考資源

### 官方文檔
- [Bybit API 文檔](https://bybit-exchange.github.io/docs/)
- [Binance API 文檔](https://binance-docs.github.io/apidocs/)
- [OKX API 文檔](https://www.okx.com/docs-v5/)
- [Bitget API 文檔](https://bitgetlimited.github.io/apidoc/)

### 技術文檔
- [Node.js 官方文檔](https://nodejs.org/docs/)
- [Express.js 官方文檔](https://expressjs.com/)
- [MongoDB 官方文檔](https://docs.mongodb.com/)
- [Redis 官方文檔](https://redis.io/documentation)

### 最佳實踐
- [Node.js 最佳實踐](https://github.com/goldbergyoni/nodebestpractices)
- [API 設計最佳實踐](https://restfulapi.net/)
- [WebSocket 最佳實踐](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

---

**注意**：本指南會隨著系統的發展持續更新，請定期查看最新版本。
