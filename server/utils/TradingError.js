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
