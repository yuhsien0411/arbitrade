/**
 * Binance 公共 API 客戶端
 * 用於獲取公共數據（ticker、orderbook 等），不需要認證
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class BinancePublicClient {
  constructor() {
    this.baseURL = 'https://api.binance.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ArbitrageBot/1.0.0'
      }
    });
  }

  /**
   * 獲取當前最優掛單數據 (ticker.book)
   * 返回最高買單和最低賣單的價格和數量
   */
  async getTicker(symbol) {
    try {
      const response = await this.client.get('/api/v3/ticker/bookTicker', {
        params: {
          symbol: symbol
        }
      });

      return {
        success: true,
        data: {
          lastUpdateId: response.data.lastUpdateId || 0,
          symbol: response.data.symbol,
          bidPrice: parseFloat(response.data.bidPrice),
          bidQty: parseFloat(response.data.bidQty),
          askPrice: parseFloat(response.data.askPrice),
          askQty: parseFloat(response.data.askQty),
          time: response.data.time || Date.now(),
          timestamp: Date.now()
        }
      };
    } catch (error) {
      logger.error('[BinancePublicClient] 獲取 ticker 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取所有交易對的最優掛單數據
   */
  async getAllTickers() {
    try {
      const response = await this.client.get('/api/v3/ticker/bookTicker');

      const tickers = Array.isArray(response.data) 
        ? response.data.map(ticker => ({
            lastUpdateId: ticker.lastUpdateId || 0,
            symbol: ticker.symbol,
            bidPrice: parseFloat(ticker.bidPrice),
            bidQty: parseFloat(ticker.bidQty),
            askPrice: parseFloat(ticker.askPrice),
            askQty: parseFloat(ticker.askQty),
            time: ticker.time || Date.now(),
            timestamp: Date.now()
          }))
        : [{
            lastUpdateId: response.data.lastUpdateId || 0,
            symbol: response.data.symbol,
            bidPrice: parseFloat(response.data.bidPrice),
            bidQty: parseFloat(response.data.bidQty),
            askPrice: parseFloat(response.data.askPrice),
            askQty: parseFloat(response.data.askQty),
            time: response.data.time || Date.now(),
            timestamp: Date.now()
          }];

      return {
        success: true,
        data: tickers
      };
    } catch (error) {
      logger.error('[BinancePublicClient] 獲取所有 ticker 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取訂單簿數據
   */
  async getOrderBook(symbol, limit = 25) {
    try {
      const response = await this.client.get('/api/v3/depth', {
        params: {
          symbol: symbol,
          limit: limit
        }
      });

      return {
        success: true,
        data: {
          symbol: symbol,
          bids: response.data.bids.map(([price, size]) => [parseFloat(price), parseFloat(size)]),
          asks: response.data.asks.map(([price, size]) => [parseFloat(price), parseFloat(size)]),
          timestamp: Date.now()
        }
      };
    } catch (error) {
      logger.error('[BinancePublicClient] 獲取 orderbook 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取 24hr ticker 統計
   */
  async get24hrTicker(symbol) {
    try {
      const response = await this.client.get('/api/v3/ticker/24hr', {
        params: {
          symbol: symbol
        }
      });

      return {
        success: true,
        data: {
          symbol: response.data.symbol,
          bidPrice: parseFloat(response.data.bidPrice),
          askPrice: parseFloat(response.data.askPrice),
          lastPrice: parseFloat(response.data.lastPrice),
          volume: parseFloat(response.data.volume),
          timestamp: response.data.closeTime
        }
      };
    } catch (error) {
      logger.error('[BinancePublicClient] 獲取 24hr ticker 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取多個交易對的 ticker 數據
   */
  async getBatchTickers(symbols) {
    try {
      const response = await this.client.get('/api/v3/ticker/bookTicker', {
        params: {
          symbols: JSON.stringify(symbols)
        }
      });

      const tickers = Array.isArray(response.data) 
        ? response.data.map(ticker => ({
            symbol: ticker.symbol,
            bidPrice: parseFloat(ticker.bidPrice),
            askPrice: parseFloat(ticker.askPrice),
            lastPrice: 0,
            volume: 0,
            timestamp: Date.now()
          }))
        : [{
            symbol: response.data.symbol,
            bidPrice: parseFloat(response.data.bidPrice),
            askPrice: parseFloat(response.data.askPrice),
            lastPrice: 0,
            volume: 0,
            timestamp: Date.now()
          }];

      return {
        success: true,
        data: tickers
      };
    } catch (error) {
      logger.error('[BinancePublicClient] 獲取批量 ticker 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取支持的交易對列表
   */
  async getSymbols() {
    try {
      const response = await this.client.get('/api/v3/exchangeInfo');
      
      const symbols = response.data.symbols
        .filter(symbol => symbol.status === 'TRADING')
        .map(symbol => symbol.symbol);

      return {
        success: true,
        data: symbols
      };
    } catch (error) {
      logger.error('[BinancePublicClient] 獲取交易對列表失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取服務器時間
   */
  async getServerTime() {
    try {
      const response = await this.client.get('/api/v3/time');
      
      return {
        success: true,
        data: {
          timeSecond: response.data.serverTime / 1000,
          timeNano: response.data.serverTime
        }
      };
    } catch (error) {
      logger.error('[BinancePublicClient] 獲取服務器時間失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = BinancePublicClient;
