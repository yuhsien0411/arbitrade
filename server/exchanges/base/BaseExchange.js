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
