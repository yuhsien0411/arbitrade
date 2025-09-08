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
