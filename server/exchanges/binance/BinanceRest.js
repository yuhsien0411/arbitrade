/**
 * Binance REST API 客戶端
 * 繼承自 BaseRest，實現所有抽象方法
 */
const BaseRest = require('../base/BaseRest');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');

class BinanceRest extends BaseRest {
  constructor(config) {
    super({
      name: 'Binance',
      baseUrl: config.testnet ? 'https://testnet.binance.vision' : 'https://api.binance.com',
      ...config
    });
    
    this.baseUrl = config.testnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
    
    this.client = null;
    this.rateLimiter = {
      requests: 0,
      window: 60000, // 1分鐘
      lastReset: Date.now()
    };
  }

  /**
   * 初始化 REST 客戶端
   */
  async initialize() {
    try {
      // 創建 axios 實例
      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BinanceArbitrageBot/1.0'
        }
      });

      // 添加請求攔截器
      this.client.interceptors.request.use(
        (config) => {
          this.incrementRequestCount();
          return config;
        },
        (error) => {
          return Promise.reject(error);
        }
      );

      // 添加響應攔截器
      this.client.interceptors.response.use(
        (response) => {
          return response;
        },
        (error) => {
          if (error.response) {
            logger.error(`[BinanceRest] API 錯誤: ${error.response.status} - ${error.response.data?.msg || error.message}`);
          }
          return Promise.reject(error);
        }
      );

      // 測試連接
      await this.testConnection();
      
      this.isInitialized = true;
      logger.info('[BinanceRest] 初始化成功');
      
    } catch (error) {
      logger.error('[BinanceRest] 初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 測試連接
   */
  async testConnection() {
    try {
      const response = await this.client.get('/api/v3/ping');
      logger.info('[BinanceRest] 連接測試成功');
      return response.data;
    } catch (error) {
      logger.error('[BinanceRest] 連接測試失敗:', error);
      throw error;
    }
  }

  /**
   * 發送 HTTP 請求
   */
  async request(method, endpoint, params = {}, headers = {}) {
    try {
      // 檢查速率限制
      if (!this.checkRateLimit()) {
        throw new Error('請求頻率過高，請稍後再試');
      }

      // 添加認證簽名（如果需要）
      if (this.config.apiKey && this.config.secret && endpoint.includes('private')) {
        const signature = this.createSignature(params);
        params.signature = signature;
        headers['X-MBX-APIKEY'] = this.config.apiKey;
      }

      const config = {
        method,
        url: endpoint,
        headers
      };

      if (method === 'GET' || method === 'DELETE') {
        config.params = params;
      } else {
        config.data = params;
      }

      const response = await this.client(config);
      return this.processResponse(response.data);

    } catch (error) {
      logger.error(`[BinanceRest] 請求失敗 ${method} ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * 創建簽名
   */
  createSignature(params) {
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return crypto
      .createHmac('sha256', this.config.secret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * 獲取服務器時間
   */
  async getServerTime() {
    try {
      const response = await this.get('/api/v3/time');
      return response.serverTime;
    } catch (error) {
      logger.error('[BinanceRest] 獲取服務器時間失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取交易對信息
   */
  async getInstruments(category = 'spot') {
    try {
      let endpoint = '/api/v3/exchangeInfo';
      
      if (category === 'futures') {
        endpoint = '/fapi/v1/exchangeInfo';
      } else if (category === 'options') {
        endpoint = '/eapi/v1/exchangeInfo';
      }

      const response = await this.get(endpoint);
      
      return response.symbols.map(symbol => ({
        symbol: symbol.symbol,
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        status: symbol.status,
        isSpotTradingAllowed: symbol.isSpotTradingAllowed,
        isMarginTradingAllowed: symbol.isMarginTradingAllowed,
        filters: symbol.filters,
        permissions: symbol.permissions
      }));
    } catch (error) {
      logger.error(`[BinanceRest] 獲取交易對信息失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取行情數據
   */
  async getTicker(symbol) {
    try {
      const response = await this.get('/api/v3/ticker/24hr', { symbol });
      
      return {
        symbol: response.symbol,
        price: parseFloat(response.lastPrice),
        change: parseFloat(response.priceChangePercent),
        changeAmount: parseFloat(response.priceChange),
        volume: parseFloat(response.volume),
        quoteVolume: parseFloat(response.quoteVolume),
        high: parseFloat(response.highPrice),
        low: parseFloat(response.lowPrice),
        open: parseFloat(response.openPrice),
        timestamp: response.closeTime,
        exchange: 'Binance'
      };
    } catch (error) {
      logger.error(`[BinanceRest] 獲取行情失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 獲取訂單簿
   */
  async getOrderBook(symbol, limit = 100) {
    try {
      const response = await this.get('/api/v3/depth', { 
        symbol, 
        limit: Math.min(limit, 5000) 
      });
      
      return {
        symbol: symbol,
        bids: response.bids.map(bid => [parseFloat(bid[0]), parseFloat(bid[1])]),
        asks: response.asks.map(ask => [parseFloat(ask[0]), parseFloat(ask[1])]),
        timestamp: Date.now(),
        exchange: 'Binance'
      };
    } catch (error) {
      logger.error(`[BinanceRest] 獲取訂單簿失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 下單
   */
  async placeOrder(orderData) {
    try {
      const params = {
        symbol: orderData.symbol,
        side: orderData.side.toUpperCase(),
        type: orderData.type.toUpperCase(),
        quantity: orderData.amount,
        timestamp: Date.now()
      };

      if (orderData.type === 'limit') {
        params.price = orderData.price;
        params.timeInForce = orderData.timeInForce || 'GTC';
      }

      if (orderData.clientOrderId) {
        params.newClientOrderId = orderData.clientOrderId;
      }

      const response = await this.post('/api/v3/order', params);
      
      return {
        id: response.orderId,
        symbol: response.symbol,
        side: response.side,
        amount: parseFloat(response.origQty),
        price: parseFloat(response.price || 0),
        status: response.status,
        timestamp: response.transactTime,
        exchange: 'Binance'
      };
    } catch (error) {
      logger.error(`[BinanceRest] 下單失敗:`, error);
      throw error;
    }
  }

  /**
   * 取消訂單
   */
  async cancelOrder(orderId, symbol) {
    try {
      const params = {
        symbol: symbol,
        orderId: orderId,
        timestamp: Date.now()
      };

      const response = await this.delete('/api/v3/order', params);
      
      return {
        id: response.orderId,
        symbol: response.symbol,
        status: response.status,
        timestamp: Date.now(),
        exchange: 'Binance'
      };
    } catch (error) {
      logger.error(`[BinanceRest] 取消訂單失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取持倉
   */
  async getPositions() {
    try {
      const response = await this.get('/fapi/v2/positionRisk');
      
      return response.map(position => ({
        symbol: position.symbol,
        side: parseFloat(position.positionAmt) > 0 ? 'long' : 'short',
        amount: Math.abs(parseFloat(position.positionAmt)),
        entryPrice: parseFloat(position.entryPrice),
        markPrice: parseFloat(position.markPrice),
        unrealizedPnl: parseFloat(position.unRealizedProfit),
        percentage: parseFloat(position.percentage),
        timestamp: Date.now(),
        exchange: 'Binance'
      }));
    } catch (error) {
      logger.error('[BinanceRest] 獲取持倉失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取餘額
   */
  async getBalance() {
    try {
      const response = await this.get('/api/v3/account', { timestamp: Date.now() });
      
      return response.balances
        .filter(balance => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map(balance => ({
          currency: balance.asset,
          free: parseFloat(balance.free),
          used: parseFloat(balance.locked),
          total: parseFloat(balance.free) + parseFloat(balance.locked),
          exchange: 'Binance'
        }));
    } catch (error) {
      logger.error('[BinanceRest] 獲取餘額失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取交易歷史
   */
  async getTradeHistory(symbol, limit = 100) {
    try {
      const response = await this.get('/api/v3/myTrades', {
        symbol: symbol,
        limit: Math.min(limit, 1000),
        timestamp: Date.now()
      });
      
      return response.map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.isBuyer ? 'buy' : 'sell',
        amount: parseFloat(trade.qty),
        price: parseFloat(trade.price),
        fee: parseFloat(trade.commission),
        feeAsset: trade.commissionAsset,
        timestamp: trade.time,
        exchange: 'Binance'
      }));
    } catch (error) {
      logger.error(`[BinanceRest] 獲取交易歷史失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 獲取訂單歷史
   */
  async getOrderHistory(symbol, limit = 100) {
    try {
      const response = await this.get('/api/v3/allOrders', {
        symbol: symbol,
        limit: Math.min(limit, 1000),
        timestamp: Date.now()
      });
      
      return response.map(order => ({
        id: order.orderId,
        symbol: order.symbol,
        side: order.side,
        amount: parseFloat(order.origQty),
        price: parseFloat(order.price || 0),
        status: order.status,
        type: order.type,
        timestamp: order.time,
        exchange: 'Binance'
      }));
    } catch (error) {
      logger.error(`[BinanceRest] 獲取訂單歷史失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 獲取當前訂單
   */
  async getOpenOrders(symbol = null) {
    try {
      const params = { timestamp: Date.now() };
      if (symbol) {
        params.symbol = symbol;
      }

      const response = await this.get('/api/v3/openOrders', params);
      
      return response.map(order => ({
        id: order.orderId,
        symbol: order.symbol,
        side: order.side,
        amount: parseFloat(order.origQty),
        price: parseFloat(order.price || 0),
        status: order.status,
        type: order.type,
        timestamp: order.time,
        exchange: 'Binance'
      }));
    } catch (error) {
      logger.error(`[BinanceRest] 獲取當前訂單失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取K線數據
   */
  async getKlines(symbol, interval = '1m', limit = 500) {
    try {
      const response = await this.get('/api/v3/klines', {
        symbol: symbol,
        interval: interval,
        limit: Math.min(limit, 1000)
      });
      
      return response.map(kline => ({
        symbol: symbol,
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        quoteVolume: parseFloat(kline[7]),
        openTime: kline[0],
        closeTime: kline[6],
        interval: interval,
        timestamp: kline[6],
        exchange: 'Binance'
      }));
    } catch (error) {
      logger.error(`[BinanceRest] 獲取K線數據失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 獲取24小時價格變動統計
   */
  async get24hrTicker(symbol = null) {
    try {
      const endpoint = symbol ? '/api/v3/ticker/24hr' : '/api/v3/ticker/24hr';
      const params = symbol ? { symbol } : {};
      
      const response = await this.get(endpoint, params);
      
      if (symbol) {
        return this.formatTickerData(response);
      } else {
        return response.map(ticker => this.formatTickerData(ticker));
      }
    } catch (error) {
      logger.error(`[BinanceRest] 獲取24小時統計失敗:`, error);
      throw error;
    }
  }

  /**
   * 格式化行情數據
   */
  formatTickerData(data) {
    return {
      symbol: data.symbol,
      price: parseFloat(data.lastPrice),
      change: parseFloat(data.priceChangePercent),
      changeAmount: parseFloat(data.priceChange),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
      high: parseFloat(data.highPrice),
      low: parseFloat(data.lowPrice),
      open: parseFloat(data.openPrice),
      timestamp: data.closeTime,
      exchange: 'Binance'
    };
  }

  /**
   * 檢查速率限制
   */
  checkRateLimit() {
    const now = Date.now();
    
    // 重置計數器
    if (now - this.rateLimiter.lastReset > this.rateLimiter.window) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.lastReset = now;
    }
    
    // Binance 限制：每分鐘 1200 次請求
    return this.rateLimiter.requests < 1200;
  }

  /**
   * 處理響應數據
   */
  processResponse(data) {
    // 檢查是否有錯誤
    if (data.code && data.code !== 200) {
      throw new Error(`Binance API 錯誤: ${data.msg} (代碼: ${data.code})`);
    }
    
    return data;
  }
}

module.exports = BinanceRest;
