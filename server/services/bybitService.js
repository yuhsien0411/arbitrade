/**
 * Bybit API 服務
 * 使用官方 bybit-api SDK 進行真實交易
 */

const { RestClientV5, WebsocketClient } = require('bybit-api');
const logger = require('../utils/logger');

class BybitService {
  constructor() {
    this.restClient = null;
    this.wsClient = null;
    this.isConnected = false;
    this.positions = new Map();
    this.balances = new Map();
    // 以 symbol 為鍵的頂部報價快取（來自 tickers 推送）
    this.tickerCache = new Map();
  }

  /**
   * 初始化Bybit客戶端
   */
  initialize() {
    try {
      const apiKey = process.env.BYBIT_API_KEY;
      const apiSecret = process.env.BYBIT_SECRET;
      const testnet = process.env.BYBIT_TESTNET === 'true';

      if (!apiKey || !apiSecret) {
        logger.error('Bybit API密鑰未配置');
        return false;
      }

      // 使用真實平台（非測試網）
      this.restClient = new RestClientV5({
        key: apiKey,
        secret: apiSecret,
        testnet: false, // 強制使用真實平台
      });

      // === WS-IMPORTANT: 建立 Bybit V5 WebSocket 客戶端（公共 + 私有皆可） ===
      this.wsClient = new WebsocketClient({
        key: apiKey,
        secret: apiSecret,
        market: 'v5',
        testnet: false, // 強制使用真實平台
      });

      this.setupWebSocketHandlers();
      this.isConnected = true;
      
      logger.info('[WS_INIT] Bybit WebSocket 客戶端已建立 (market=v5, env=mainnet)');
      return true;
    } catch (error) {
      logger.error('Bybit服務初始化失敗:', error);
      return false;
    }
  }

  /**
   * 設置WebSocket事件處理器
   */
  setupWebSocketHandlers() {
    this.wsClient.on('update', (data) => {
      this.handleWebSocketUpdate(data);
    });

    this.wsClient.on('open', () => {
      // === WS-IMPORTANT: 連線成功事件 ===
      logger.info('[WS_OPEN] Bybit WebSocket 連線已建立');
    });

    this.wsClient.on('error', (error) => {
      // === WS-IMPORTANT: 連線錯誤事件 ===
      logger.error('[WS_ERROR] Bybit WebSocket 錯誤:', error);
    });

    this.wsClient.on('close', () => {
      // === WS-IMPORTANT: 連線關閉事件 ===
      logger.warn('[WS_CLOSE] Bybit WebSocket 連線已關閉');
      this.isConnected = false;
    });
  }

  /**
   * 處理WebSocket數據更新
   */
  handleWebSocketUpdate(data) {
    try {
      // 可選：輸出 WS 原始更新（大量），以環境變數控制
      if (process.env.LOG_WS_RAW === 'true') {
        try {
          logger.info('[WS_UPDATE_RAW]', JSON.stringify(data));
        } catch (_) {}
      }

      if (data.topic && data.topic.includes('orderbook')) {
        // 處理訂單簿數據
        this.handleOrderBookUpdate(data);
      } else if (data.topic && data.topic.startsWith('tickers.')) {
        // 處理 ticker 顶部報價（100ms 推送）
        this.handleTickerUpdate(data);
      } else if (data.topic && data.topic.includes('position')) {
        // 處理持倉數據
        this.handlePositionUpdate(data);
      } else if (data.topic && data.topic.includes('wallet')) {
        // 處理錢包餘額數據
        this.handleWalletUpdate(data);
      }
    } catch (error) {
      logger.error('處理WebSocket數據失敗:', error);
    }
  }

  /**
   * 獲取賬戶信息
   */
  async getAccountInfo() {
    try {
      if (!this.restClient) {
        throw new Error('Bybit客戶端未初始化');
      }

      // 獲取錢包餘額
      const walletResponse = await this.restClient.getWalletBalance({
        accountType: 'UNIFIED'
      });

      // 獲取持倉信息
      const positionResponse = await this.restClient.getPositionInfo({
        category: 'linear'
      });

      return {
        success: true,
        data: {
          balances: walletResponse.result?.list || [],
          positions: positionResponse.result?.list || []
        }
      };
    } catch (error) {
      logger.error('獲取賬戶信息失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取交易對信息
   */
  async getInstruments(category = 'linear') {
    try {
      if (!this.restClient) {
        throw new Error('Bybit客戶端未初始化');
      }

      const response = await this.restClient.getInstrumentsInfo({
        category: category
      });

      return {
        success: true,
        data: response.result?.list || []
      };
    } catch (error) {
      logger.error('獲取交易對信息失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取訂單簿數據
   */
  async getOrderBook(symbol, category = 'linear') {
    try {
      if (!this.restClient) {
        throw new Error('Bybit客戶端未初始化');
      }

      const response = await this.restClient.getOrderbook({
        category: category,
        symbol: symbol,
        limit: 25
      });

      return {
        success: true,
        data: response.result
      };
    } catch (error) {
      logger.error('獲取訂單簿失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 下單
   */
  async placeOrder(orderParams) {
    try {
      if (!this.restClient) {
        throw new Error('Bybit客戶端未初始化');
      }

      const {
        symbol,
        side,
        orderType = 'Market',
        qty,
        price,
        category = 'linear'
      } = orderParams;

      const orderData = {
        category: category,
        symbol: symbol,
        side: side,
        orderType: orderType,
        qty: qty.toString()
      };

      if (orderType === 'Limit' && price) {
        orderData.price = price.toString();
      }

      logger.trading('送出下單', { side, orderType, symbol, qty, category });

      const response = await this.restClient.submitOrder(orderData);

      logger.trading('下單成功', { symbol, side, orderType, qty, category, result: response.result });

      return {
        success: true,
        data: response.result
      };
    } catch (error) {
      logger.error('下單失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 取消訂單
   */
  async cancelOrder(symbol, orderId, category = 'linear') {
    try {
      if (!this.restClient) {
        throw new Error('Bybit客戶端未初始化');
      }

      const response = await this.restClient.cancelOrder({
        category: category,
        symbol: symbol,
        orderId: orderId
      });

      return {
        success: true,
        data: response.result
      };
    } catch (error) {
      logger.error('取消訂單失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取訂單歷史
   */
  async getOrders(symbol, category = 'linear') {
    try {
      if (!this.restClient) {
        throw new Error('Bybit客戶端未初始化');
      }

      const response = await this.restClient.getActiveOrders({
        category: category,
        symbol: symbol
      });

      return {
        success: true,
        data: response.result?.list || []
      };
    } catch (error) {
      logger.error('獲取訂單歷史失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 訂閱價格數據
   */
  subscribeToOrderBook(symbols) {
    try {
      if (!this.wsClient) {
        throw new Error('WebSocket客戶端未初始化');
      }

      symbols.forEach(symbol => {
        this.wsClient.subscribeV5(`orderbook.25.${symbol}`, 'linear');
      });

      logger.info(`已訂閱價格數據: ${symbols.join(', ')}`);
    } catch (error) {
      logger.error('訂閱價格數據失敗:', error);
    }
  }

  /**
   * 訂閱 tickers（頂部報價，推送頻率通常為 ~100ms）
   */
  subscribeToTickers(items, defaultCategory = 'linear') {
    try {
      if (!this.wsClient) {
        throw new Error('WebSocket客戶端未初始化');
      }

      const normalized = Array.isArray(items) ? items : [items];
      const subscribed = [];
      normalized.forEach(entry => {
        const symbol = typeof entry === 'string' ? entry : entry.symbol;
        const category = typeof entry === 'string' ? defaultCategory : (entry.category || defaultCategory);
        if (!symbol) return;
        
        // 同時訂閱 tickers 和 orderbook depth=1（10ms 更新更即時）
        this.wsClient.subscribeV5(`tickers.${symbol}`, category);
        this.wsClient.subscribeV5(`orderbook.1.${symbol}`, category);
        
        subscribed.push(`${symbol}@${category}(tickers+orderbook)`);
        logger.info(`[WS_SUB] tickers+orderbook 訂閱已送出 -> symbol=${symbol}, category=${category}`);
      });

      if (subscribed.length > 0) {
        logger.info(`[WS_SUB_OK] 已訂閱: ${subscribed.join(', ')}`);
      }
    } catch (error) {
      logger.error('[WS_SUB_ERR] 訂閱失敗:', error);
    }
  }

  /**
   * 處理 tickers 推送，快取 bid1/ask1
   */
  handleTickerUpdate(message) {
    try {
      const { ts, data } = message;
      if (!data || !data.symbol) return;

      const bidPrice = Number(data.bidPrice || 0);
      const askPrice = Number(data.askPrice || 0);
      const bidSize = Number(data.bidSize || 0);
      const askSize = Number(data.askSize || 0);

      const top = {
        symbol: data.symbol,
        exchange: 'bybit',
        bid1: bidPrice > 0 ? { price: bidPrice, amount: bidSize } : null,
        ask1: askPrice > 0 ? { price: askPrice, amount: askSize } : null,
        ts: ts || Date.now()
      };

      this.tickerCache.set(data.symbol, top);
      // === WS-IMPORTANT: 這裡可看到最新的頂部報價被更新 ===
      if (process.env.LOG_WS_TICKS === 'true') {
        logger.info(`[WS_TICK] symbol=${data.symbol} bid=${bidPrice} size=${bidSize} ask=${askPrice} size=${askSize} ts=${top.ts}`);
        try {
          logger.debug('[WS_TICK_RAW]', JSON.stringify(message));
        } catch (_) {}
      }
    } catch (error) {
      logger.error('處理 tickers 更新失敗:', error);
    }
  }

  /**
   * 取得頂部報價（若尚未有快取則回傳 null）
   */
  getTopOfBook(symbol) {
    return this.tickerCache.get(symbol) || null;
  }

  /**
   * 測試API連接
   */
  async testConnection() {
    try {
      if (!this.restClient) {
        return {
          success: false,
          message: 'API客戶端未初始化'
        };
      }

      // 1. 測試基本API連接（獲取服務器時間）
      const serverTimeResponse = await this.restClient.getServerTime();
      
      if (serverTimeResponse.retCode !== 0) {
        return {
          success: false,
          message: 'API連接測試失敗: ' + serverTimeResponse.retMsg
        };
      }

      // 2. 測試API權限（查詢賬戶配置）
      const accountInfoResponse = await this.restClient.getAccountInfo();
      
      if (accountInfoResponse.retCode === 0) {
        const accountInfo = accountInfoResponse.result;
        
        // 解析保證金模式
        const marginModeMap = {
          'ISOLATED_MARGIN': '逐倉保證金',
          'REGULAR_MARGIN': '全倉保證金',
          'PORTFOLIO_MARGIN': '組合保證金'
        };
        
        // 解析賬戶狀態
        const getUnifiedMarginStatusText = (status) => {
          switch (status) {
            case 1: return '經典帳戶';
            case 3: return '統一帳戶1.0';
            case 4: return '統一帳戶1.0 (pro版本)';
            case 5: return '統一帳戶2.0';
            case 6: return '統一帳戶2.0 (pro版本)';
            default: return `未知狀態(${status})`;
          }
        };
        
        return {
          success: true,
          message: 'API連接和權限測試成功',
          serverTime: serverTimeResponse.result.timeSecond,
          accountInfo: {
            marginMode: accountInfo.marginMode,
            marginModeText: marginModeMap[accountInfo.marginMode] || accountInfo.marginMode,
            unifiedMarginStatus: accountInfo.unifiedMarginStatus,
            unifiedMarginStatusText: getUnifiedMarginStatusText(accountInfo.unifiedMarginStatus),
            isMasterTrader: accountInfo.isMasterTrader,
            spotHedgingStatus: accountInfo.spotHedgingStatus,
            spotHedgingStatusText: accountInfo.spotHedgingStatus === 'ON' ? '已開啟' : '未開啟',
            updatedTime: accountInfo.updatedTime
          }
        };
      } else {
        // 如果賬戶信息查詢失敗，但服務器時間正常，說明API密鑰權限不足
        return {
          success: false,
          message: 'API權限不足，無法查詢賬戶信息: ' + accountInfoResponse.retMsg,
          serverTime: serverTimeResponse.result.timeSecond,
          suggestion: '請檢查API密鑰是否具有"讀取"權限'
        };
      }
    } catch (error) {
      logger.error('API連接測試失敗:', error);
      
      // 分析錯誤類型
      let errorMessage = 'API連接測試失敗: ' + error.message;
      let suggestion = '';
      
      if (error.message.includes('Invalid API key')) {
        errorMessage = 'API密鑰無效';
        suggestion = '請檢查API Key是否正確';
      } else if (error.message.includes('signature invalid')) {
        errorMessage = 'API簽名無效';
        suggestion = '請檢查Secret Key是否正確';
      } else if (error.message.includes('timestamp')) {
        errorMessage = 'API時間戳錯誤';
        suggestion = '請檢查系統時間是否正確';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = '網絡連接失敗';
        suggestion = '請檢查網絡連接或防火牆設置';
      }
      
      return {
        success: false,
        message: errorMessage,
        suggestion: suggestion
      };
    }
  }

  /**
   * 處理訂單簿更新（depth=1，10ms 更新）
   */
  handleOrderBookUpdate(data) {
    try {
      const { ts, data: orderbookData } = data;
      if (!orderbookData || !orderbookData.s) return;

      const symbol = orderbookData.s;
      const bids = orderbookData.b || []; // [[price, size], ...]
      const asks = orderbookData.a || []; // [[price, size], ...]

      const bestBid = Array.isArray(bids) && bids.length > 0 ? bids[0] : null;
      const bestAsk = Array.isArray(asks) && asks.length > 0 ? asks[0] : null;

      const top = {
        symbol,
        exchange: 'bybit',
        bid1: bestBid && bestBid.length >= 2 ? { price: Number(bestBid[0]), amount: Number(bestBid[1]) } : null,
        ask1: bestAsk && bestAsk.length >= 2 ? { price: Number(bestAsk[0]), amount: Number(bestAsk[1]) } : null,
        ts: ts || Date.now(),
        source: 'orderbook' // 標記來源
      };

      // 優先使用 orderbook（10ms 更新）覆蓋 tickers（100ms 更新）
      this.tickerCache.set(symbol, top);

      if (process.env.LOG_WS_TICKS === 'true') {
        logger.info(`[WS_OB] symbol=${symbol} bid=${top.bid1?.price} size=${top.bid1?.amount} ask=${top.ask1?.price} size=${top.ask1?.amount} ts=${top.ts}`);
      }
    } catch (error) {
      logger.error('處理 orderbook 更新失敗:', error);
    }
  }

  /**
   * 處理持倉更新
   */
  handlePositionUpdate(data) {
    // 實現持倉數據處理邏輯
  }

  /**
   * 處理錢包更新
   */
  handleWalletUpdate(data) {
    // 實現錢包餘額處理邏輯
  }

  /**
   * 關閉連接
   */
  disconnect() {
    if (this.wsClient) {
      this.wsClient.closeAll();
    }
    this.isConnected = false;
    logger.info('Bybit服務已斷開連接');
  }
}

module.exports = new BybitService();