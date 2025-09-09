/**
 * Binance 交易所主類
 * 繼承自 BaseExchange，實現所有抽象方法
 */
const BaseExchange = require('../base/BaseExchange');
const BinanceWebSocket = require('./BinanceWebSocket');
const BinanceRest = require('./BinanceRest');
const logger = require('../../utils/logger');

class BinanceExchange extends BaseExchange {
  constructor(config) {
    super({
      name: 'Binance',
      ...config
    });
    
    this.restClient = null;
    this.wsClient = null;
  }

  /**
   * 初始化交易所
   */
  async initialize() {
    try {
      // 初始化 REST 客戶端
      this.restClient = new BinanceRest(this.config);
      await this.restClient.initialize();

      // 初始化 WebSocket 客戶端
      this.wsClient = new BinanceWebSocket(this.config);
      await this.wsClient.connect();

      // 設置 WebSocket 事件監聽
      this.setupWebSocketEventHandlers();

      this.isConnected = true;
      this.isInitialized = true;
      
      logger.info('[BinanceExchange] 交易所初始化成功');
      return true;
    } catch (error) {
      logger.error('[BinanceExchange] 初始化失敗:', error);
      this.isConnected = false;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 設置 WebSocket 事件監聽
   */
  setupWebSocketEventHandlers() {
    this.wsClient.on('ticker', (data) => {
      this.tickerCache.set(data.symbol, data);
      this.emit('ticker', data);
    });

    this.wsClient.on('orderbook', (data) => {
      this.orderBookCache.set(data.symbol, data);
      this.emit('orderbook', data);
    });

    this.wsClient.on('trade', (data) => {
      this.emit('trade', data);
    });

    this.wsClient.on('error', (error) => {
      logger.error('[BinanceExchange] WebSocket 錯誤:', error);
      this.emit('error', error);
    });
  }

  /**
   * 獲取賬戶信息
   */
  async getAccountInfo() {
    try {
      const startTime = Date.now();
      const balance = await this.restClient.getBalance();
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      return {
        exchange: 'Binance',
        balance: balance,
        timestamp: Date.now()
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BinanceExchange] 獲取賬戶信息失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取訂單簿數據
   */
  async getOrderBook(symbol, category = 'spot') {
    try {
      const startTime = Date.now();
      const orderBook = await this.restClient.getOrderBook(symbol, 100);
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      this.orderBookCache.set(symbol, orderBook);
      
      return orderBook;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 獲取訂單簿失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 下單
   */
  async placeOrder(orderParams) {
    try {
      const startTime = Date.now();
      
      // 風險檢查
      await this.validateOrder(orderParams);
      
      const result = await this.restClient.placeOrder(orderParams);
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      logger.info(`[BinanceExchange] 下單成功:`, {
        symbol: orderParams.symbol,
        side: orderParams.side,
        amount: orderParams.amount,
        price: orderParams.price,
        orderId: result.id
      });
      
      return result;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 下單失敗:`, error);
      throw error;
    }
  }

  /**
   * 取消訂單
   */
  async cancelOrder(symbol, orderId, category = 'spot') {
    try {
      const startTime = Date.now();
      const result = await this.restClient.cancelOrder(orderId, symbol);
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      logger.info(`[BinanceExchange] 取消訂單成功:`, {
        orderId,
        symbol
      });
      
      return result;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 取消訂單失敗:`, error);
      throw error;
    }
  }

  /**
   * 訂閱價格數據
   */
  async subscribeToTickers(symbols) {
    try {
      for (const symbol of symbols) {
        this.wsClient.subscribeTicker(symbol);
        logger.info(`[BinanceExchange] 訂閱行情: ${symbol}`);
      }
      return true;
    } catch (error) {
      logger.error(`[BinanceExchange] 訂閱行情失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取交易對列表
   */
  async getInstruments(category = 'spot') {
    try {
      const startTime = Date.now();
      const instruments = await this.restClient.getInstruments(category);
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      return instruments;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 獲取交易對列表失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取持倉信息
   */
  async getPosition(symbol) {
    try {
      const startTime = Date.now();
      const positions = await this.restClient.getPositions();
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      // 查找指定交易對的持倉
      const position = positions.find(p => p.symbol === symbol);
      return position || null;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 獲取持倉失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 獲取餘額信息
   */
  async getBalance(currency = null) {
    try {
      const startTime = Date.now();
      const balance = await this.restClient.getBalance();
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      if (currency) {
        return balance.find(b => b.currency === currency) || null;
      }
      
      return balance;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 獲取餘額失敗:`, error);
      throw error;
    }
  }

  /**
   * 訂閱行情
   */
  subscribeTicker(symbol) {
    try {
      this.wsClient.subscribeTicker(symbol);
      logger.info(`[BinanceExchange] 訂閱行情: ${symbol}`);
    } catch (error) {
      logger.error(`[BinanceExchange] 訂閱行情失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 訂閱訂單簿
   */
  subscribeOrderBook(symbol) {
    try {
      this.wsClient.subscribeOrderBook(symbol);
      logger.info(`[BinanceExchange] 訂閱訂單簿: ${symbol}`);
    } catch (error) {
      logger.error(`[BinanceExchange] 訂閱訂單簿失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 訂閱交易
   */
  subscribeTrades(symbol) {
    try {
      this.wsClient.subscribeTrades(symbol);
      logger.info(`[BinanceExchange] 訂閱交易: ${symbol}`);
    } catch (error) {
      logger.error(`[BinanceExchange] 訂閱交易失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 取消訂閱
   */
  unsubscribe(symbol) {
    try {
      this.wsClient.unsubscribe(symbol);
      logger.info(`[BinanceExchange] 取消訂閱: ${symbol}`);
    } catch (error) {
      logger.error(`[BinanceExchange] 取消訂閱失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 清理資源
   */
  async cleanup() {
    try {
      if (this.wsClient) {
        await this.wsClient.disconnect();
      }
      
      await super.cleanup();
      
      logger.info('[BinanceExchange] 清理完成');
    } catch (error) {
      logger.error('[BinanceExchange] 清理失敗:', error);
    }
  }

  /**
   * 驗證訂單
   */
  async validateOrder(orderData) {
    if (!orderData.symbol || !orderData.side || orderData.amount === undefined || orderData.amount === null) {
      throw new Error('訂單數據不完整');
    }
    
    if (orderData.amount <= 0) {
      throw new Error('訂單數量必須大於0');
    }
    
    if (orderData.type === 'limit' && (!orderData.price || orderData.price <= 0)) {
      throw new Error('限價單必須指定有效價格');
    }
    
    // 可以添加更多驗證邏輯，如餘額檢查等
  }

  /**
   * 獲取交易歷史
   */
  async getTradeHistory(symbol, limit = 100) {
    try {
      const startTime = Date.now();
      const trades = await this.restClient.getTradeHistory(symbol, limit);
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      return trades;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 獲取交易歷史失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 獲取訂單歷史
   */
  async getOrderHistory(symbol, limit = 100) {
    try {
      const startTime = Date.now();
      const orders = await this.restClient.getOrderHistory(symbol, limit);
      const responseTime = Date.now() - startTime;
      
      this.updateStats(true, responseTime);
      
      return orders;
    } catch (error) {
      this.updateStats(false);
      logger.error(`[BinanceExchange] 獲取訂單歷史失敗 ${symbol}:`, error);
      throw error;
    }
  }
}

module.exports = BinanceExchange;
