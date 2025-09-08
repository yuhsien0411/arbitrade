# 📋 Day 1-2 任務文檔 - 開發者A

## 🎯 任務概述
**負責人**：開發者A  
**時間**：Day 1-2（今天-明天）  
**目標**：創建 BaseExchange 抽象類，建立交易所統一接口規範

## 📁 需要創建的文件結構
```
server/
├── exchanges/
│   ├── base/
│   │   ├── BaseExchange.js      # 主要抽象類
│   │   ├── BaseWebSocket.js     # WebSocket基類
│   │   └── BaseRest.js          # REST API基類
│   └── index.js                 # 交易所工廠
├── utils/
│   └── TradingError.js          # 統一錯誤處理
└── tests/
    └── exchanges/
        └── base/
            └── BaseExchange.test.js  # 單元測試
```

## 🔧 Day 1 任務：創建 BaseExchange 抽象類

### 1. 創建 `exchanges/base/BaseExchange.js`

```javascript
/**
 * 交易所基類 - 定義統一的交易所接口
 * 所有交易所適配器都必須繼承此類並實現抽象方法
 */
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class BaseExchange extends EventEmitter {
  constructor(config) {
    super();
    
    // 基本配置
    this.config = {
      name: config.name || 'Unknown',
      apiKey: config.apiKey,
      secret: config.secret,
      testnet: config.testnet || false,
      ...config
    };
    
    // 客戶端實例
    this.restClient = null;
    this.wsClient = null;
    
    // 連接狀態
    this.isConnected = false;
    this.isInitialized = false;
    
    // 數據緩存
    this.tickerCache = new Map();
    this.orderBookCache = new Map();
    this.balanceCache = new Map();
    this.positionCache = new Map();
    
    // 統計信息
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null,
      averageResponseTime: 0
    };
  }

  /**
   * 初始化交易所連接
   * 子類必須實現此方法
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    throw new Error('initialize() method must be implemented by subclass');
  }

  /**
   * 獲取賬戶信息
   * 子類必須實現此方法
   * @returns {Promise<Object>} 賬戶信息
   */
  async getAccountInfo() {
    throw new Error('getAccountInfo() method must be implemented by subclass');
  }

  /**
   * 獲取訂單簿數據
   * 子類必須實現此方法
   * @param {string} symbol - 交易對符號
   * @param {string} category - 交易類別 (spot/linear/inverse)
   * @returns {Promise<Object>} 訂單簿數據
   */
  async getOrderBook(symbol, category = 'linear') {
    throw new Error('getOrderBook() method must be implemented by subclass');
  }

  /**
   * 下單
   * 子類必須實現此方法
   * @param {Object} orderParams - 訂單參數
   * @returns {Promise<Object>} 下單結果
   */
  async placeOrder(orderParams) {
    throw new Error('placeOrder() method must be implemented by subclass');
  }

  /**
   * 取消訂單
   * 子類必須實現此方法
   * @param {string} symbol - 交易對符號
   * @param {string} orderId - 訂單ID
   * @param {string} category - 交易類別
   * @returns {Promise<Object>} 取消結果
   */
  async cancelOrder(symbol, orderId, category = 'linear') {
    throw new Error('cancelOrder() method must be implemented by subclass');
  }

  /**
   * 訂閱價格數據
   * 子類必須實現此方法
   * @param {Array} symbols - 交易對列表
   * @returns {Promise<boolean>} 訂閱是否成功
   */
  async subscribeToTickers(symbols) {
    throw new Error('subscribeToTickers() method must be implemented by subclass');
  }

  /**
   * 獲取交易對列表
   * 子類必須實現此方法
   * @param {string} category - 交易類別
   * @returns {Promise<Array>} 交易對列表
   */
  async getInstruments(category = 'linear') {
    throw new Error('getInstruments() method must be implemented by subclass');
  }

  /**
   * 獲取持倉信息
   * 子類必須實現此方法
   * @param {string} symbol - 交易對符號
   * @returns {Promise<Object>} 持倉信息
   */
  async getPosition(symbol) {
    throw new Error('getPosition() method must be implemented by subclass');
  }

  /**
   * 獲取餘額信息
   * 子類必須實現此方法
   * @param {string} currency - 幣種
   * @returns {Promise<Object>} 餘額信息
   */
  async getBalance(currency) {
    throw new Error('getBalance() method must be implemented by subclass');
  }

  // ========== 通用方法 ==========

  /**
   * 檢查交易所是否已連接
   * @returns {boolean} 連接狀態
   */
  isExchangeConnected() {
    return this.isConnected && this.isInitialized;
  }

  /**
   * 獲取交易所名稱
   * @returns {string} 交易所名稱
   */
  getExchangeName() {
    return this.config.name;
  }

  /**
   * 獲取頂部報價
   * @param {string} symbol - 交易對符號
   * @returns {Object|null} 頂部報價數據
   */
  getTopOfBook(symbol) {
    return this.tickerCache.get(symbol) || null;
  }

  /**
   * 獲取訂單簿緩存
   * @param {string} symbol - 交易對符號
   * @returns {Object|null} 訂單簿數據
   */
  getOrderBookCache(symbol) {
    return this.orderBookCache.get(symbol) || null;
  }

  /**
   * 更新統計信息
   * @param {boolean} success - 請求是否成功
   * @param {number} responseTime - 響應時間
   */
  updateStats(success, responseTime = 0) {
    this.stats.totalRequests++;
    this.stats.lastRequestTime = Date.now();
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
    
    // 計算平均響應時間
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;
  }

  /**
   * 獲取統計信息
   * @returns {Object} 統計信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 清理資源
   * 子類可以重寫此方法進行額外的清理工作
   */
  async cleanup() {
    this.isConnected = false;
    this.isInitialized = false;
    this.tickerCache.clear();
    this.orderBookCache.clear();
    this.balanceCache.clear();
    this.positionCache.clear();
    
    logger.info(`${this.config.name} 交易所資源已清理`);
  }

  /**
   * 測試連接
   * 子類可以重寫此方法進行連接測試
   * @returns {Promise<Object>} 測試結果
   */
  async testConnection() {
    try {
      const startTime = Date.now();
      const accountInfo = await this.getAccountInfo();
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      return {
        success: true,
        message: `${this.config.name} 連接測試成功`,
        responseTime: responseTime,
        data: accountInfo
      };
    } catch (error) {
      this.updateStats(false);
      
      return {
        success: false,
        message: `${this.config.name} 連接測試失敗: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 格式化錯誤信息
   * @param {Error} error - 原始錯誤
   * @param {string} operation - 操作名稱
   * @returns {Object} 格式化的錯誤信息
   */
  formatError(error, operation) {
    return {
      exchange: this.config.name,
      operation: operation,
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
}

module.exports = BaseExchange;
```

### 2. 創建 `exchanges/base/BaseWebSocket.js`

```javascript
/**
 * WebSocket 基類 - 定義統一的 WebSocket 接口
 */
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class BaseWebSocket extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.wsClient = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000;
    this.subscriptions = new Set();
  }

  /**
   * 連接 WebSocket
   * 子類必須實現此方法
   * @returns {Promise<boolean>} 連接是否成功
   */
  async connect() {
    throw new Error('connect() method must be implemented by subclass');
  }

  /**
   * 斷開 WebSocket 連接
   * 子類必須實現此方法
   */
  async disconnect() {
    throw new Error('disconnect() method must be implemented by subclass');
  }

  /**
   * 訂閱數據流
   * 子類必須實現此方法
   * @param {string} topic - 訂閱主題
   * @param {Object} params - 訂閱參數
   */
  async subscribe(topic, params = {}) {
    throw new Error('subscribe() method must be implemented by subclass');
  }

  /**
   * 取消訂閱
   * 子類必須實現此方法
   * @param {string} topic - 訂閱主題
   */
  async unsubscribe(topic) {
    throw new Error('unsubscribe() method must be implemented by subclass');
  }

  /**
   * 處理 WebSocket 消息
   * 子類必須實現此方法
   * @param {Object} data - 接收到的數據
   */
  handleMessage(data) {
    throw new Error('handleMessage() method must be implemented by subclass');
  }

  /**
   * 檢查連接狀態
   * @returns {boolean} 是否已連接
   */
  isWSConnected() {
    return this.isConnected;
  }

  /**
   * 獲取訂閱列表
   * @returns {Array} 訂閱列表
   */
  getSubscriptions() {
    return Array.from(this.subscriptions);
  }

  /**
   * 重連機制
   */
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('WebSocket 重連次數已達上限，停止重連');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`WebSocket 重連中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        this.reconnectAttempts = 0;
        logger.info('WebSocket 重連成功');
      } catch (error) {
        logger.error('WebSocket 重連失敗:', error);
        await this.reconnect();
      }
    }, this.reconnectInterval);
  }
}

module.exports = BaseWebSocket;
```

### 3. 創建 `exchanges/base/BaseRest.js`

```javascript
/**
 * REST API 基類 - 定義統一的 REST API 接口
 */
const logger = require('../../utils/logger');

class BaseRest {
  constructor(config) {
    this.config = config;
    this.restClient = null;
    this.rateLimiter = {
      requests: 0,
      window: 60000, // 1分鐘
      lastReset: Date.now()
    };
  }

  /**
   * 初始化 REST 客戶端
   * 子類必須實現此方法
   */
  async initialize() {
    throw new Error('initialize() method must be implemented by subclass');
  }

  /**
   * 發送 HTTP 請求
   * 子類必須實現此方法
   * @param {string} method - HTTP 方法
   * @param {string} endpoint - API 端點
   * @param {Object} params - 請求參數
   * @param {Object} headers - 請求頭
   */
  async request(method, endpoint, params = {}, headers = {}) {
    throw new Error('request() method must be implemented by subclass');
  }

  /**
   * GET 請求
   * @param {string} endpoint - API 端點
   * @param {Object} params - 請求參數
   */
  async get(endpoint, params = {}) {
    return this.request('GET', endpoint, params);
  }

  /**
   * POST 請求
   * @param {string} endpoint - API 端點
   * @param {Object} data - 請求數據
   */
  async post(endpoint, data = {}) {
    return this.request('POST', endpoint, data);
  }

  /**
   * PUT 請求
   * @param {string} endpoint - API 端點
   * @param {Object} data - 請求數據
   */
  async put(endpoint, data = {}) {
    return this.request('PUT', endpoint, data);
  }

  /**
   * DELETE 請求
   * @param {string} endpoint - API 端點
   * @param {Object} params - 請求參數
   */
  async delete(endpoint, params = {}) {
    return this.request('DELETE', endpoint, params);
  }

  /**
   * 檢查速率限制
   * @returns {boolean} 是否可以發送請求
   */
  checkRateLimit() {
    const now = Date.now();
    
    // 重置計數器
    if (now - this.rateLimiter.lastReset > this.rateLimiter.window) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.lastReset = now;
    }
    
    return this.rateLimiter.requests < this.config.rateLimit?.requests || 1000;
  }

  /**
   * 增加請求計數
   */
  incrementRequestCount() {
    this.rateLimiter.requests++;
  }

  /**
   * 格式化請求參數
   * @param {Object} params - 原始參數
   * @returns {Object} 格式化後的參數
   */
  formatParams(params) {
    // 子類可以重寫此方法進行參數格式化
    return params;
  }

  /**
   * 處理響應數據
   * @param {Object} response - 原始響應
   * @returns {Object} 處理後的響應
   */
  processResponse(response) {
    // 子類可以重寫此方法進行響應處理
    return response;
  }
}

module.exports = BaseRest;
```

## 🔧 Day 2 任務：創建交易所工廠和錯誤處理

### 4. 創建 `exchanges/index.js`

```javascript
/**
 * 交易所工廠 - 統一創建和管理交易所實例
 */
const logger = require('../utils/logger');
const TradingError = require('../utils/TradingError');

class ExchangeFactory {
  static exchanges = new Map();
  static configs = new Map();

  /**
   * 創建交易所實例
   * @param {string} exchangeName - 交易所名稱
   * @param {Object} config - 交易所配置
   * @returns {Object} 交易所實例
   */
  static createExchange(exchangeName, config) {
    try {
      const normalizedName = exchangeName.toLowerCase();
      
      // 檢查是否已存在實例
      if (this.exchanges.has(normalizedName)) {
        logger.info(`返回已存在的 ${exchangeName} 交易所實例`);
        return this.exchanges.get(normalizedName);
      }

      // 驗證配置
      this.validateConfig(normalizedName, config);

      // 創建交易所實例
      let exchange;
      switch (normalizedName) {
        case 'bybit':
          const BybitExchange = require('./bybit/BybitExchange');
          exchange = new BybitExchange(config);
          break;
        case 'binance':
          const BinanceExchange = require('./binance/BinanceExchange');
          exchange = new BinanceExchange(config);
          break;
        case 'okx':
          const OkxExchange = require('./okx/OkxExchange');
          exchange = new OkxExchange(config);
          break;
        case 'bitget':
          const BitgetExchange = require('./bitget/BitgetExchange');
          exchange = new BitgetExchange(config);
          break;
        default:
          throw new TradingError(
            `不支援的交易所: ${exchangeName}`,
            'UNSUPPORTED_EXCHANGE',
            exchangeName
          );
      }

      // 保存實例和配置
      this.exchanges.set(normalizedName, exchange);
      this.configs.set(normalizedName, config);

      logger.info(`成功創建 ${exchangeName} 交易所實例`);
      return exchange;

    } catch (error) {
      logger.error(`創建 ${exchangeName} 交易所失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取交易所實例
   * @param {string} exchangeName - 交易所名稱
   * @returns {Object|null} 交易所實例
   */
  static getExchange(exchangeName) {
    const normalizedName = exchangeName.toLowerCase();
    return this.exchanges.get(normalizedName) || null;
  }

  /**
   * 獲取所有交易所實例
   * @returns {Map} 所有交易所實例
   */
  static getAllExchanges() {
    return new Map(this.exchanges);
  }

  /**
   * 移除交易所實例
   * @param {string} exchangeName - 交易所名稱
   * @returns {boolean} 是否成功移除
   */
  static removeExchange(exchangeName) {
    const normalizedName = exchangeName.toLowerCase();
    const exchange = this.exchanges.get(normalizedName);
    
    if (exchange) {
      // 清理資源
      exchange.cleanup();
      this.exchanges.delete(normalizedName);
      this.configs.delete(normalizedName);
      logger.info(`已移除 ${exchangeName} 交易所實例`);
      return true;
    }
    
    return false;
  }

  /**
   * 初始化所有交易所
   * @returns {Promise<Object>} 初始化結果
   */
  static async initializeAll() {
    const results = {};
    
    for (const [name, exchange] of this.exchanges) {
      try {
        const success = await exchange.initialize();
        results[name] = { success, error: null };
        logger.info(`${name} 交易所初始化${success ? '成功' : '失敗'}`);
      } catch (error) {
        results[name] = { success: false, error: error.message };
        logger.error(`${name} 交易所初始化失敗:`, error);
      }
    }
    
    return results;
  }

  /**
   * 獲取所有交易所狀態
   * @returns {Object} 交易所狀態信息
   */
  static getStatus() {
    const status = {};
    
    for (const [name, exchange] of this.exchanges) {
      status[name] = {
        connected: exchange.isExchangeConnected(),
        name: exchange.getExchangeName(),
        stats: exchange.getStats(),
        config: this.configs.get(name) ? '已配置' : '未配置'
      };
    }
    
    return status;
  }

  /**
   * 驗證交易所配置
   * @param {string} exchangeName - 交易所名稱
   * @param {Object} config - 配置對象
   */
  static validateConfig(exchangeName, config) {
    if (!config) {
      throw new TradingError(
        '交易所配置不能為空',
        'INVALID_CONFIG',
        exchangeName
      );
    }

    // 基本配置驗證
    if (!config.name) {
      throw new TradingError(
        '交易所名稱不能為空',
        'INVALID_CONFIG',
        exchangeName
      );
    }

    // API 密鑰驗證
    if (!config.apiKey || !config.secret) {
      throw new TradingError(
        'API 密鑰和密鑰不能為空',
        'INVALID_CONFIG',
        exchangeName
      );
    }

    // 特定交易所的配置驗證
    switch (exchangeName) {
      case 'okx':
      case 'bitget':
        if (!config.passphrase) {
          throw new TradingError(
            'OKX/Bitget 需要 passphrase',
            'INVALID_CONFIG',
            exchangeName
          );
        }
        break;
    }
  }

  /**
   * 清理所有交易所實例
   */
  static async cleanupAll() {
    logger.info('開始清理所有交易所實例...');
    
    for (const [name, exchange] of this.exchanges) {
      try {
        await exchange.cleanup();
        logger.info(`${name} 交易所已清理`);
      } catch (error) {
        logger.error(`清理 ${name} 交易所失敗:`, error);
      }
    }
    
    this.exchanges.clear();
    this.configs.clear();
    logger.info('所有交易所實例已清理完成');
  }
}

module.exports = ExchangeFactory;
```

### 5. 創建 `utils/TradingError.js`

```javascript
/**
 * 交易錯誤類 - 統一的錯誤處理
 */
class TradingError extends Error {
  constructor(message, code, exchange, details = {}) {
    super(message);
    
    this.name = 'TradingError';
    this.code = code;
    this.exchange = exchange;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // 保持錯誤堆棧
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TradingError);
    }
  }

  /**
   * 轉換為 JSON 格式
   * @returns {Object} JSON 格式的錯誤信息
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      exchange: this.exchange,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * 轉換為字符串格式
   * @returns {string} 字符串格式的錯誤信息
   */
  toString() {
    return `[${this.exchange}] ${this.code}: ${this.message}`;
  }

  /**
   * 創建 API 錯誤
   * @param {string} message - 錯誤消息
   * @param {string} exchange - 交易所名稱
   * @param {Object} details - 錯誤詳情
   * @returns {TradingError} 交易錯誤實例
   */
  static createApiError(message, exchange, details = {}) {
    return new TradingError(message, 'API_ERROR', exchange, details);
  }

  /**
   * 創建配置錯誤
   * @param {string} message - 錯誤消息
   * @param {string} exchange - 交易所名稱
   * @param {Object} details - 錯誤詳情
   * @returns {TradingError} 交易錯誤實例
   */
  static createConfigError(message, exchange, details = {}) {
    return new TradingError(message, 'CONFIG_ERROR', exchange, details);
  }

  /**
   * 創建網絡錯誤
   * @param {string} message - 錯誤消息
   * @param {string} exchange - 交易所名稱
   * @param {Object} details - 錯誤詳情
   * @returns {TradingError} 交易錯誤實例
   */
  static createNetworkError(message, exchange, details = {}) {
    return new TradingError(message, 'NETWORK_ERROR', exchange, details);
  }

  /**
   * 創建驗證錯誤
   * @param {string} message - 錯誤消息
   * @param {string} exchange - 交易所名稱
   * @param {Object} details - 錯誤詳情
   * @returns {TradingError} 交易錯誤實例
   */
  static createValidationError(message, exchange, details = {}) {
    return new TradingError(message, 'VALIDATION_ERROR', exchange, details);
  }
}

module.exports = TradingError;
```

## 🧪 單元測試要求

### 6. 創建 `tests/exchanges/base/BaseExchange.test.js`

```javascript
/**
 * BaseExchange 單元測試
 */
const BaseExchange = require('../../../exchanges/base/BaseExchange');
const TradingError = require('../../../utils/TradingError');

describe('BaseExchange', () => {
  let exchange;
  let config;

  beforeEach(() => {
    config = {
      name: 'TestExchange',
      apiKey: 'test_key',
      secret: 'test_secret',
      testnet: true
    };
    
    // 創建測試用的子類
    class TestExchange extends BaseExchange {
      async initialize() { return true; }
      async getAccountInfo() { return { balance: 1000 }; }
      async getOrderBook(symbol, category) { return { bids: [], asks: [] }; }
      async placeOrder(orderParams) { return { orderId: '123' }; }
      async cancelOrder(symbol, orderId, category) { return { success: true }; }
      async subscribeToTickers(symbols) { return true; }
      async getInstruments(category) { return []; }
      async getPosition(symbol) { return { size: 0 }; }
      async getBalance(currency) { return { free: 1000 }; }
    }
    
    exchange = new TestExchange(config);
  });

  describe('構造函數', () => {
    test('應該正確初始化配置', () => {
      expect(exchange.config.name).toBe('TestExchange');
      expect(exchange.config.apiKey).toBe('test_key');
      expect(exchange.config.secret).toBe('test_secret');
      expect(exchange.config.testnet).toBe(true);
    });

    test('應該初始化默認狀態', () => {
      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
      expect(exchange.tickerCache).toBeInstanceOf(Map);
      expect(exchange.orderBookCache).toBeInstanceOf(Map);
    });
  });

  describe('通用方法', () => {
    test('isExchangeConnected 應該返回正確狀態', () => {
      expect(exchange.isExchangeConnected()).toBe(false);
      
      exchange.isConnected = true;
      exchange.isInitialized = true;
      expect(exchange.isExchangeConnected()).toBe(true);
    });

    test('getExchangeName 應該返回交易所名稱', () => {
      expect(exchange.getExchangeName()).toBe('TestExchange');
    });

    test('getTopOfBook 應該返回緩存的價格數據', () => {
      const mockData = { bid1: { price: 100 }, ask1: { price: 101 } };
      exchange.tickerCache.set('BTCUSDT', mockData);
      
      expect(exchange.getTopOfBook('BTCUSDT')).toEqual(mockData);
      expect(exchange.getTopOfBook('ETHUSDT')).toBeNull();
    });

    test('updateStats 應該正確更新統計信息', () => {
      exchange.updateStats(true, 100);
      exchange.updateStats(false, 200);
      
      expect(exchange.stats.totalRequests).toBe(2);
      expect(exchange.stats.successfulRequests).toBe(1);
      expect(exchange.stats.failedRequests).toBe(1);
      expect(exchange.stats.averageResponseTime).toBe(150);
    });

    test('getStats 應該返回格式化的統計信息', () => {
      exchange.updateStats(true, 100);
      exchange.updateStats(false, 200);
      
      const stats = exchange.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successRate).toBe('50.00%');
    });
  });

  describe('抽象方法', () => {
    test('未實現的抽象方法應該拋出錯誤', async () => {
      const abstractExchange = new BaseExchange(config);
      
      await expect(abstractExchange.initialize()).rejects.toThrow('initialize() method must be implemented by subclass');
      await expect(abstractExchange.getAccountInfo()).rejects.toThrow('getAccountInfo() method must be implemented by subclass');
      await expect(abstractExchange.getOrderBook('BTCUSDT')).rejects.toThrow('getOrderBook() method must be implemented by subclass');
      await expect(abstractExchange.placeOrder({})).rejects.toThrow('placeOrder() method must be implemented by subclass');
    });
  });

  describe('testConnection', () => {
    test('應該成功測試連接', async () => {
      const result = await exchange.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('TestExchange');
      expect(result.data).toEqual({ balance: 1000 });
    });

    test('應該處理連接失敗', async () => {
      // 創建會失敗的交易所
      class FailingExchange extends BaseExchange {
        async initialize() { return true; }
        async getAccountInfo() { throw new Error('Connection failed'); }
        async getOrderBook() { throw new Error('Not implemented'); }
        async placeOrder() { throw new Error('Not implemented'); }
        async cancelOrder() { throw new Error('Not implemented'); }
        async subscribeToTickers() { throw new Error('Not implemented'); }
        async getInstruments() { throw new Error('Not implemented'); }
        async getPosition() { throw new Error('Not implemented'); }
        async getBalance() { throw new Error('Not implemented'); }
      }
      
      const failingExchange = new FailingExchange(config);
      const result = await failingExchange.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('連接測試失敗');
    });
  });

  describe('cleanup', () => {
    test('應該正確清理資源', async () => {
      exchange.tickerCache.set('BTCUSDT', { price: 100 });
      exchange.orderBookCache.set('BTCUSDT', { bids: [] });
      exchange.balanceCache.set('USDT', { free: 1000 });
      exchange.positionCache.set('BTCUSDT', { size: 1 });
      
      await exchange.cleanup();
      
      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
      expect(exchange.tickerCache.size).toBe(0);
      expect(exchange.orderBookCache.size).toBe(0);
      expect(exchange.balanceCache.size).toBe(0);
      expect(exchange.positionCache.size).toBe(0);
    });
  });
});
```

## ✅ 驗收標準

### Day 1 完成標準：
- [ ] `BaseExchange.js` 創建完成
- [ ] `BaseWebSocket.js` 創建完成  
- [ ] `BaseRest.js` 創建完成
- [ ] 所有抽象方法定義完整
- [ ] 通用方法實現正確
- [ ] 錯誤處理機制完善

### Day 2 完成標準：
- [ ] `ExchangeFactory.js` 創建完成
- [ ] `TradingError.js` 創建完成
- [ ] 工廠模式實現正確
- [ ] 錯誤處理類實現完整
- [ ] 單元測試創建完成
- [ ] 測試覆蓋率 > 90%

## 📝 提交要求

### 代碼提交規範：
```bash
# 提交格式
git add .
git commit -m "feat: 創建 BaseExchange 抽象層和工廠模式

- 實現 BaseExchange 抽象類
- 實現 BaseWebSocket 和 BaseRest 基類
- 實現 ExchangeFactory 工廠模式
- 實現 TradingError 統一錯誤處理
- 添加完整的單元測試

Closes #1"
```

### 代碼審查要求：
1. **功能完整性**：所有抽象方法都有定義
2. **錯誤處理**：完善的錯誤處理機制
3. **代碼規範**：符合 ESLint 規範
4. **測試覆蓋**：單元測試覆蓋率 > 90%
5. **文檔完整**：所有方法都有 JSDoc 註釋

## 🚨 注意事項

1. **不要修改現有代碼**：只創建新文件，不修改現有功能
2. **保持向後兼容**：確保新架構不影響現有功能
3. **錯誤處理**：所有方法都要有完善的錯誤處理
4. **性能考慮**：注意內存使用和性能優化
5. **日誌記錄**：重要操作都要有日誌記錄

## 📞 支持聯繫

如有任何問題，請立即聯繫 PM：
- **技術問題**：PM 提供技術支持
- **進度問題**：每日晚上6點前回報進度
- **緊急問題**：立即聯繫，不要等待

---

**記住**：這是項目的基礎，必須高質量完成！每個抽象方法都要仔細設計，為後續的交易所實現打好基礎。
