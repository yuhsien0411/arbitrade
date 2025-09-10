/**
 * Bybit 公共 API 客戶端
 * 用於獲取公共數據（ticker、orderbook 等），不需要認證
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class BybitPublicClient {
  constructor() {
    this.baseURL = 'https://api.bybit.com';
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
   * 獲取 ticker 數據
   */
  async getTicker(symbol, category = 'spot') {
    try {
      const response = await this.client.get('/v5/market/tickers', {
        params: {
          category: category,
          symbol: symbol
        }
      });

      if (response.data.retCode === 0) {
        const ticker = response.data.result.list[0];
        return {
          success: true,
          data: {
            symbol: ticker.symbol,
            bidPrice: parseFloat(ticker.bid1Price),
            askPrice: parseFloat(ticker.ask1Price),
            lastPrice: parseFloat(ticker.lastPrice),
            volume: parseFloat(ticker.volume24h),
            timestamp: parseInt(ticker.time)
          }
        };
      } else {
        throw new Error(`Bybit API 錯誤: ${response.data.retMsg}`);
      }
    } catch (error) {
      logger.error('[BybitPublicClient] 獲取 ticker 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取訂單簿數據
   */
  async getOrderBook(symbol, category = 'spot', limit = 25) {
    try {
      const response = await this.client.get('/v5/market/orderbook', {
        params: {
          category: category,
          symbol: symbol,
          limit: limit
        }
      });

      if (response.data.retCode === 0) {
        const orderBook = response.data.result;
        return {
          success: true,
          data: {
            symbol: orderBook.s,
            bids: orderBook.b.map(([price, size]) => [parseFloat(price), parseFloat(size)]),
            asks: orderBook.a.map(([price, size]) => [parseFloat(price), parseFloat(size)]),
            timestamp: parseInt(orderBook.ts)
          }
        };
      } else {
        throw new Error(`Bybit API 錯誤: ${response.data.retMsg}`);
      }
    } catch (error) {
      logger.error('[BybitPublicClient] 獲取 orderbook 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取多個交易對的 ticker 數據
   */
  async getBatchTickers(symbols, category = 'spot') {
    try {
      const response = await this.client.get('/v5/market/tickers', {
        params: {
          category: category,
          symbol: symbols.join(',')
        }
      });

      if (response.data.retCode === 0) {
        const tickers = response.data.result.list.map(ticker => ({
          symbol: ticker.symbol,
          bidPrice: parseFloat(ticker.bid1Price),
          askPrice: parseFloat(ticker.ask1Price),
          lastPrice: parseFloat(ticker.lastPrice),
          volume: parseFloat(ticker.volume24h),
          timestamp: parseInt(ticker.time)
        }));

        return {
          success: true,
          data: tickers
        };
      } else {
        throw new Error(`Bybit API 錯誤: ${response.data.retMsg}`);
      }
    } catch (error) {
      logger.error('[BybitPublicClient] 獲取批量 ticker 失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取支持的交易對列表
   */
  async getSymbols(category = 'spot') {
    try {
      const response = await this.client.get('/v5/market/instruments-info', {
        params: {
          category: category,
          status: 'Trading'
        }
      });

      if (response.data.retCode === 0) {
        const symbols = response.data.result.list.map(instrument => instrument.symbol);
        return {
          success: true,
          data: symbols
        };
      } else {
        throw new Error(`Bybit API 錯誤: ${response.data.retMsg}`);
      }
    } catch (error) {
      logger.error('[BybitPublicClient] 獲取交易對列表失敗:', error);
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
      const response = await this.client.get('/v5/market/time');
      
      if (response.data.retCode === 0) {
        return {
          success: true,
          data: {
            timeSecond: response.data.result.timeSecond,
            timeNano: response.data.result.timeNano
          }
        };
      } else {
        throw new Error(`Bybit API 錯誤: ${response.data.retMsg}`);
      }
    } catch (error) {
      logger.error('[BybitPublicClient] 獲取服務器時間失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = BybitPublicClient;
