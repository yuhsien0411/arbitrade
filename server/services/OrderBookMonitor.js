/**
 * 訂單簿監控服務
 * 使用 WebSocket 監控多個交易所的 orderbook 數據
 * 專注於套利機會檢測和風險管理
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const BybitPublicClient = require('../exchanges/bybit/BybitPublicClient');
const BinancePublicClient = require('../exchanges/binance/BinancePublicClient');

class OrderBookMonitor extends EventEmitter {
  constructor() {
    super();
    this.monitoringPairs = new Map();
    this.exchangeConnections = new Map();
    this.orderBookData = new Map();
    this.arbitrageOpportunities = new Map();
    this.isRunning = false;
  }

  /**
   * 啟動監控服務
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[OrderBookMonitor] 監控服務已在運行中');
      return;
    }

    try {
      logger.info('[OrderBookMonitor] 啟動訂單簿監控服務...');
      
      // 初始化交易所連接
      await this.initializeExchangeConnections();
      
      // 開始監控循環
      this.startMonitoringLoop();
      
      this.isRunning = true;
      logger.info('[OrderBookMonitor] 訂單簿監控服務啟動成功');
      
    } catch (error) {
      logger.error('[OrderBookMonitor] 啟動失敗:', error);
      throw error;
    }
  }

  /**
   * 停止監控服務
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('[OrderBookMonitor] 停止訂單簿監控服務...');
      
      // 關閉所有交易所連接
      for (const [exchange, connection] of this.exchangeConnections) {
        try {
          await connection.disconnect();
          logger.info(`[OrderBookMonitor] ${exchange} 連接已關閉`);
        } catch (error) {
          logger.error(`[OrderBookMonitor] 關閉 ${exchange} 連接失敗:`, error);
        }
      }
      
      this.exchangeConnections.clear();
      this.monitoringPairs.clear();
      this.orderBookData.clear();
      this.arbitrageOpportunities.clear();
      
      this.isRunning = false;
      logger.info('[OrderBookMonitor] 訂單簿監控服務已停止');
      
    } catch (error) {
      logger.error('[OrderBookMonitor] 停止失敗:', error);
    }
  }

  /**
   * 初始化交易所連接
   */
  async initializeExchangeConnections() {
    logger.info('[OrderBookMonitor] 初始化交易所連接...');
    
    // 初始化公共 API 客戶端
    this.bybitClient = new BybitPublicClient();
    this.binanceClient = new BinancePublicClient();
    
    // 設置交易所連接
    this.exchangeConnections.set('bybit', {
      client: this.bybitClient,
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      subscribe: (symbol) => Promise.resolve()
    });
    
    this.exchangeConnections.set('binance', {
      client: this.binanceClient,
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      subscribe: (symbol) => Promise.resolve()
    });
  }

  /**
   * 開始監控循環
   */
  startMonitoringLoop() {
    // 每 2 秒檢查一次套利機會（降低頻率，避免 API 限制）
    this.monitoringInterval = setInterval(async () => {
      await this.updateOrderBookData();
      this.checkArbitrageOpportunities();
    }, 2000);
  }

  /**
   * 更新訂單簿數據
   */
  async updateOrderBookData() {
    for (const [pairId, pair] of this.monitoringPairs) {
      try {
        // 並行獲取兩個交易所的 orderbook 數據
        const [leg1Result, leg2Result] = await Promise.allSettled([
          this.getOrderBookData(pair.leg1.exchange, pair.leg1.symbol),
          this.getOrderBookData(pair.leg2.exchange, pair.leg2.symbol)
        ]);

        if (leg1Result.status === 'fulfilled' && leg1Result.value.success) {
          this.setOrderBookData(pair.leg1.exchange, pair.leg1.symbol, leg1Result.value.data);
        }

        if (leg2Result.status === 'fulfilled' && leg2Result.value.success) {
          this.setOrderBookData(pair.leg2.exchange, pair.leg2.symbol, leg2Result.value.data);
        }
      } catch (error) {
        logger.error(`[OrderBookMonitor] 更新交易對 ${pairId} 數據失敗:`, error);
      }
    }
  }

  /**
   * 獲取訂單簿數據
   */
  async getOrderBookData(exchange, symbol) {
    const connection = this.exchangeConnections.get(exchange);
    if (!connection || !connection.client) {
      return { success: false, error: '交易所連接不存在' };
    }

    try {
      if (exchange === 'bybit') {
        return await connection.client.getOrderBook(symbol, 'spot');
      } else if (exchange === 'binance') {
        return await connection.client.getOrderBook(symbol);
      } else {
        return { success: false, error: '不支援的交易所' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 添加監控交易對
   */
  addMonitoringPair(pairConfig) {
    const pairId = pairConfig.id || `pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.monitoringPairs.set(pairId, {
      ...pairConfig,
      id: pairId,
      createdAt: Date.now(),
      lastUpdate: null,
      totalUpdates: 0
    });

    logger.info(`[OrderBookMonitor] 添加監控交易對: ${pairId}`);
    
    // 訂閱相關交易所的 orderbook 數據
    this.subscribeToOrderBook(pairConfig.leg1.exchange, pairConfig.leg1.symbol);
    this.subscribeToOrderBook(pairConfig.leg2.exchange, pairConfig.leg2.symbol);
    
    return pairId;
  }

  /**
   * 移除監控交易對
   */
  removeMonitoringPair(pairId) {
    const pair = this.monitoringPairs.get(pairId);
    if (!pair) {
      return false;
    }

    // 取消訂閱
    this.unsubscribeFromOrderBook(pair.leg1.exchange, pair.leg1.symbol);
    this.unsubscribeFromOrderBook(pair.leg2.exchange, pair.leg2.symbol);
    
    this.monitoringPairs.delete(pairId);
    this.arbitrageOpportunities.delete(pairId);
    
    logger.info(`[OrderBookMonitor] 移除監控交易對: ${pairId}`);
    return true;
  }

  /**
   * 訂閱 orderbook 數據
   */
  async subscribeToOrderBook(exchange, symbol) {
    const connection = this.exchangeConnections.get(exchange);
    if (!connection) {
      logger.warn(`[OrderBookMonitor] 交易所 ${exchange} 連接不存在`);
      return;
    }

    try {
      await connection.subscribe(symbol);
      logger.info(`[OrderBookMonitor] 已訂閱 ${exchange} ${symbol} orderbook`);
    } catch (error) {
      logger.error(`[OrderBookMonitor] 訂閱 ${exchange} ${symbol} 失敗:`, error);
    }
  }

  /**
   * 取消訂閱 orderbook 數據
   */
  async unsubscribeFromOrderBook(exchange, symbol) {
    const connection = this.exchangeConnections.get(exchange);
    if (!connection) {
      return;
    }

    try {
      await connection.unsubscribe(symbol);
      logger.info(`[OrderBookMonitor] 已取消訂閱 ${exchange} ${symbol} orderbook`);
    } catch (error) {
      logger.error(`[OrderBookMonitor] 取消訂閱 ${exchange} ${symbol} 失敗:`, error);
    }
  }

  /**
   * 設置 orderbook 數據
   */
  setOrderBookData(exchange, symbol, orderBookData) {
    const key = `${exchange}_${symbol}`;
    this.orderBookData.set(key, {
      ...orderBookData,
      exchange,
      symbol,
      timestamp: Date.now()
    });

    // 觸發數據更新事件
    this.emit('orderBookUpdate', {
      exchange,
      symbol,
      data: orderBookData
    });
  }

  /**
   * 檢查套利機會
   */
  checkArbitrageOpportunities() {
    for (const [pairId, pair] of this.monitoringPairs) {
      try {
        const leg1Key = `${pair.leg1.exchange}_${pair.leg1.symbol}`;
        const leg2Key = `${pair.leg2.exchange}_${pair.leg2.symbol}`;
        
        const leg1OrderBook = this.orderBookData.get(leg1Key);
        const leg2OrderBook = this.orderBookData.get(leg2Key);
        
        if (!leg1OrderBook || !leg2OrderBook) {
          continue; // 數據不完整，跳過
        }

        // 計算套利機會
        const opportunity = this.calculateArbitrageOpportunity(pair, leg1OrderBook, leg2OrderBook);
        
        if (opportunity) {
          this.arbitrageOpportunities.set(pairId, opportunity);
          
          // 觸發套利機會事件
          this.emit('arbitrageOpportunity', {
            pairId,
            pair,
            opportunity
          });
          
          // 如果達到觸發條件，發送告警
          if (opportunity.shouldTrigger) {
            this.emit('arbitrageTrigger', {
              pairId,
              pair,
              opportunity
            });
          }
        }
        
      } catch (error) {
        logger.error(`[OrderBookMonitor] 檢查交易對 ${pairId} 套利機會失敗:`, error);
      }
    }
  }

  /**
   * 計算套利機會
   */
  calculateArbitrageOpportunity(pair, leg1OrderBook, leg2OrderBook) {
    const leg1Side = pair.leg1.side || 'buy';
    const leg2Side = pair.leg2.side || 'sell';
    
    // 獲取最佳價格
    const leg1Price = leg1Side === 'buy' 
      ? leg1OrderBook.asks[0]?.[0] 
      : leg1OrderBook.bids[0]?.[0];
    
    const leg2Price = leg2Side === 'buy' 
      ? leg2OrderBook.asks[0]?.[0] 
      : leg2OrderBook.bids[0]?.[0];
    
    if (!leg1Price || !leg2Price) {
      return null;
    }

    // 計算價差
    const spread = leg2Price - leg1Price;
    const spreadPercent = (spread / leg1Price) * 100;
    
    // 檢查是否達到觸發閾值
    const threshold = pair.threshold || 0.1;
    const shouldTrigger = Math.abs(spreadPercent) >= threshold;

    return {
      id: pair.id,
      leg1Price: {
        symbol: leg1OrderBook.symbol,
        exchange: leg1OrderBook.exchange,
        bid1: { price: leg1OrderBook.bids[0]?.[0] || 0 },
        ask1: { price: leg1OrderBook.asks[0]?.[0] || 0 }
      },
      leg2Price: {
        symbol: leg2OrderBook.symbol,
        exchange: leg2OrderBook.exchange,
        bid1: { price: leg2OrderBook.bids[0]?.[0] || 0 },
        ask1: { price: leg2OrderBook.asks[0]?.[0] || 0 }
      },
      spread,
      spreadPercent,
      shouldTrigger,
      timestamp: Date.now()
    };
  }

  /**
   * 獲取監控狀態
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      monitoringPairsCount: this.monitoringPairs.size,
      orderBookDataCount: this.orderBookData.size,
      arbitrageOpportunitiesCount: this.arbitrageOpportunities.size,
      exchanges: Array.from(this.exchangeConnections.keys())
    };
  }

  /**
   * 獲取所有套利機會
   */
  getAllArbitrageOpportunities() {
    return Array.from(this.arbitrageOpportunities.values());
  }
}

module.exports = OrderBookMonitor;
