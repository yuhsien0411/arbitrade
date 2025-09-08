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
