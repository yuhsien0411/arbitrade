/**
 * 交易所狀態管理服務
 * 統一管理所有交易所的狀態和配置
 */
const ExchangeFactory = require('../exchanges/index');
const logger = require('../utils/logger');

class ExchangeStatusService {
  constructor() {
    this.exchangeStatuses = new Map();
    this.initializeStatuses();
  }

  /**
   * 初始化交易所狀態
   */
  initializeStatuses() {
    // Bybit - 已實現並運行
    this.exchangeStatuses.set('bybit', {
      name: 'Bybit',
      status: 'active',
      connected: false,
      implemented: true,
      message: 'Bybit 交易所已實現並運行中',
      features: ['spot', 'linear', 'inverse'],
      priority: 1
    });

    // Binance - 已實現，可集成
    this.exchangeStatuses.set('binance', {
      name: 'Binance',
      status: 'ready',
      connected: false,
      implemented: true,
      message: 'Binance 交易所已準備就緒',
      features: ['spot', 'futures'],
      priority: 2
    });

    // OKX - 計劃中
    this.exchangeStatuses.set('okx', {
      name: 'OKX',
      status: 'planned',
      connected: false,
      implemented: false,
      message: 'OKX 交易所支持計劃中',
      features: ['spot', 'futures', 'options'],
      priority: 3
    });

    // Bitget - 計劃中
    this.exchangeStatuses.set('bitget', {
      name: 'Bitget',
      status: 'planned',
      connected: false,
      implemented: false,
      message: 'Bitget 交易所支持計劃中',
      features: ['spot', 'futures'],
      priority: 4
    });
  }

  /**
   * 獲取所有交易所狀態
   */
  getAllExchangeStatuses() {
    const statuses = {};
    
    for (const [key, status] of this.exchangeStatuses) {
      statuses[key] = {
        ...status,
        // 檢查實際連接狀態
        connected: this.checkConnectionStatus(key)
      };
    }
    
    return statuses;
  }

  /**
   * 獲取特定交易所狀態
   */
  getExchangeStatus(exchangeName) {
    const normalizedName = exchangeName.toLowerCase();
    const status = this.exchangeStatuses.get(normalizedName);
    
    if (!status) {
      return {
        name: exchangeName,
        status: 'unknown',
        connected: false,
        implemented: false,
        message: `未知的交易所: ${exchangeName}`,
        features: [],
        priority: 999
      };
    }
    
    return {
      ...status,
      connected: this.checkConnectionStatus(normalizedName)
    };
  }

  /**
   * 檢查交易所連接狀態
   */
  checkConnectionStatus(exchangeName) {
    try {
      const exchange = ExchangeFactory.getExchange(exchangeName);
      if (!exchange) {
        return false;
      }
      
      // 檢查交易所是否已初始化並連接
      if (exchangeName === 'binance') {
        return exchange.isConnected || false;
      } else {
        return exchange.isExchangeConnected && exchange.isExchangeConnected();
      }
    } catch (error) {
      logger.error(`檢查 ${exchangeName} 連接狀態失敗:`, error);
      return false;
    }
  }

  /**
   * 獲取已實現的交易所列表
   */
  getImplementedExchanges() {
    const implemented = [];
    
    for (const [key, status] of this.exchangeStatuses) {
      if (status.implemented) {
        implemented.push({
          name: key,
          ...status,
          connected: this.checkConnectionStatus(key)
        });
      }
    }
    
    return implemented.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 獲取計劃中的交易所列表
   */
  getPlannedExchanges() {
    const planned = [];
    
    for (const [key, status] of this.exchangeStatuses) {
      if (!status.implemented) {
        planned.push({
          name: key,
          ...status
        });
      }
    }
    
    return planned.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 獲取連接的交易所列表
   */
  getConnectedExchanges() {
    const connected = [];
    
    for (const [key, status] of this.exchangeStatuses) {
      if (status.implemented && this.checkConnectionStatus(key)) {
        connected.push({
          name: key,
          ...status,
          connected: true
        });
      }
    }
    
    return connected;
  }

  /**
   * 更新交易所狀態
   */
  updateExchangeStatus(exchangeName, updates) {
    const normalizedName = exchangeName.toLowerCase();
    const currentStatus = this.exchangeStatuses.get(normalizedName);
    
    if (!currentStatus) {
      logger.warn(`嘗試更新未知交易所狀態: ${exchangeName}`);
      return false;
    }
    
    // 更新狀態
    const updatedStatus = {
      ...currentStatus,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    this.exchangeStatuses.set(normalizedName, updatedStatus);
    
    logger.info(`更新 ${exchangeName} 交易所狀態:`, updates);
    return true;
  }

  /**
   * 獲取交易所統計信息
   */
  getExchangeStats() {
    const stats = {
      total: this.exchangeStatuses.size,
      implemented: 0,
      connected: 0,
      planned: 0,
      byStatus: {}
    };
    
    for (const [key, status] of this.exchangeStatuses) {
      if (status.implemented) {
        stats.implemented++;
      } else {
        stats.planned++;
      }
      
      if (this.checkConnectionStatus(key)) {
        stats.connected++;
      }
      
      // 按狀態分組
      if (!stats.byStatus[status.status]) {
        stats.byStatus[status.status] = 0;
      }
      stats.byStatus[status.status]++;
    }
    
    return stats;
  }

  /**
   * 獲取交易所功能支持
   */
  getExchangeFeatures() {
    const features = {};
    
    for (const [key, status] of this.exchangeStatuses) {
      if (status.implemented) {
        features[key] = {
          name: status.name,
          features: status.features,
          connected: this.checkConnectionStatus(key)
        };
      }
    }
    
    return features;
  }

  /**
   * 檢查交易所是否支持特定功能
   */
  supportsFeature(exchangeName, feature) {
    const status = this.exchangeStatuses.get(exchangeName.toLowerCase());
    return status && status.implemented && status.features.includes(feature);
  }

  /**
   * 獲取推薦的交易所組合
   */
  getRecommendedExchangePairs() {
    const implemented = this.getImplementedExchanges();
    const pairs = [];
    
    // 生成交易所組合
    for (let i = 0; i < implemented.length; i++) {
      for (let j = i + 1; j < implemented.length; j++) {
        const exchange1 = implemented[i];
        const exchange2 = implemented[j];
        
        // 檢查功能交集
        const commonFeatures = exchange1.features.filter(f => 
          exchange2.features.includes(f)
        );
        
        if (commonFeatures.length > 0) {
          pairs.push({
            exchange1: exchange1.name,
            exchange2: exchange2.name,
            commonFeatures,
            priority: Math.min(exchange1.priority, exchange2.priority)
          });
        }
      }
    }
    
    return pairs.sort((a, b) => a.priority - b.priority);
  }
}

module.exports = new ExchangeStatusService();
