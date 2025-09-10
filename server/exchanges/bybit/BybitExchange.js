/**
 * Bybit 交易所適配器
 * 繼承 BaseExchange 並實現所有抽象方法
 */
const { RestClientV5, WebsocketClient } = require('bybit-api');
const BaseExchange = require('../base/BaseExchange');
const BaseWebSocket = require('../base/BaseWebSocket');
const BaseRest = require('../base/BaseRest');
const TradingError = require('../../utils/TradingError');
const logger = require('../../utils/logger');

/**
 * Bybit WebSocket 實現
 */
class BybitWebSocket extends BaseWebSocket {
  constructor(config) {
    super(config);
    this.wsClient = null;
  }

  async connect() {
    try {
      if (!this.config.apiKey || !this.config.secret) {
        throw new TradingError('Bybit API 密鑰未配置', 'CONFIG_ERROR', 'bybit');
      }

      this.wsClient = new WebsocketClient({
        key: this.config.apiKey,
        secret: this.config.secret,
        market: 'v5',
        testnet: this.config.testnet || false
      });

      this.setupEventHandlers();
      this.isConnected = true;
      
      logger.info('[BybitWebSocket] WebSocket 連接已建立');
      return true;
    } catch (error) {
      logger.error('[BybitWebSocket] 連接失敗:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.wsClient) {
      this.wsClient.closeAll();
      this.wsClient = null;
    }
    this.isConnected = false;
    logger.info('[BybitWebSocket] WebSocket 連接已關閉');
  }

  async subscribe(topic, params = {}) {
    if (!this.wsClient || !this.isConnected) {
      throw new TradingError('WebSocket 未連接', 'CONNECTION_ERROR', 'bybit');
    }

    try {
      this.wsClient.subscribeV5(topic, params.category || 'linear');
      this.subscriptions.add(topic);
      logger.info(`[BybitWebSocket] 已訂閱: ${topic}`);
    } catch (error) {
      logger.error(`[BybitWebSocket] 訂閱失敗 ${topic}:`, error);
      throw error;
    }
  }

  async unsubscribe(topic) {
    if (!this.wsClient || !this.isConnected) {
      return;
    }

    try {
      this.wsClient.unsubscribeV5(topic);
      this.subscriptions.delete(topic);
      logger.info(`[BybitWebSocket] 已取消訂閱: ${topic}`);
    } catch (error) {
      logger.error(`[BybitWebSocket] 取消訂閱失敗 ${topic}:`, error);
    }
  }

  handleMessage(data) {
    try {
      if (data.topic && data.topic.includes('orderbook')) {
        this.handleOrderBookUpdate(data);
      } else if (data.topic && data.topic.startsWith('tickers.')) {
        this.handleTickerUpdate(data);
      } else if (data.topic && data.topic.includes('position')) {
        this.handlePositionUpdate(data);
      } else if (data.topic && data.topic.includes('wallet')) {
        this.handleWalletUpdate(data);
      }
    } catch (error) {
      logger.error('[BybitWebSocket] 處理消息失敗:', error);
    }
  }

  setupEventHandlers() {
    this.wsClient.on('update', (data) => {
      this.handleMessage(data);
    });

    this.wsClient.on('open', () => {
      logger.info('[BybitWebSocket] WebSocket 連線已建立');
      this.isConnected = true;
    });

    this.wsClient.on('error', (error) => {
      logger.error('[BybitWebSocket] WebSocket 錯誤:', error);
      this.isConnected = false;
    });

    this.wsClient.on('close', () => {
      logger.warn('[BybitWebSocket] WebSocket 連線已關閉');
      this.isConnected = false;
      this.reconnect();
    });
  }

  handleTickerUpdate(message) {
    try {
      const { ts, data } = message;
      if (!data || !data.symbol) return;

      const bidPrice = Number(data.bidPrice || 0);
      const askPrice = Number(data.askPrice || 0);
      const bidSize = Number(data.bidSize || 0);
      const askSize = Number(data.askSize || 0);

      const tickerData = {
        symbol: data.symbol,
        exchange: 'bybit',
        bid1: bidPrice > 0 ? { price: bidPrice, amount: bidSize } : null,
        ask1: askPrice > 0 ? { price: askPrice, amount: askSize } : null,
        ts: ts || Date.now(),
        source: 'ticker'
      };

      this.emit('ticker', tickerData);
    } catch (error) {
      logger.error('[BybitWebSocket] 處理 ticker 更新失敗:', error);
    }
  }

  handleOrderBookUpdate(data) {
    try {
      const { ts, data: orderbookData } = data;
      if (!orderbookData || !orderbookData.s) return;

      const symbol = orderbookData.s;
      const bids = orderbookData.b || [];
      const asks = orderbookData.a || [];

      const bestBid = Array.isArray(bids) && bids.length > 0 ? bids[0] : null;
      const bestAsk = Array.isArray(asks) && asks.length > 0 ? asks[0] : null;

      const orderbookUpdate = {
        symbol,
        exchange: 'bybit',
        bid1: bestBid && bestBid.length >= 2 ? { price: Number(bestBid[0]), amount: Number(bestBid[1]) } : null,
        ask1: bestAsk && bestAsk.length >= 2 ? { price: Number(bestAsk[0]), amount: Number(bestAsk[1]) } : null,
        ts: ts || Date.now(),
        source: 'orderbook'
      };

      this.emit('orderbook', orderbookUpdate);
    } catch (error) {
      logger.error('[BybitWebSocket] 處理 orderbook 更新失敗:', error);
    }
  }

  handlePositionUpdate(data) {
    // 實現持倉數據處理邏輯
    this.emit('position', data);
  }

  handleWalletUpdate(data) {
    // 實現錢包餘額處理邏輯
    this.emit('wallet', data);
  }
}

/**
 * Bybit REST API 實現
 */
class BybitRest extends BaseRest {
  constructor(config) {
    super(config);
    this.restClient = null;
  }

  async initialize() {
    try {
      if (!this.config.apiKey || !this.config.secret) {
        throw new TradingError('Bybit API 密鑰未配置', 'CONFIG_ERROR', 'bybit');
      }

      this.restClient = new RestClientV5({
        key: this.config.apiKey,
        secret: this.config.secret,
        testnet: this.config.testnet || false
      });

      logger.info('[BybitRest] REST 客戶端初始化成功');
      return true;
    } catch (error) {
      logger.error('[BybitRest] 初始化失敗:', error);
      throw error;
    }
  }

  async request(method, endpoint, params = {}, headers = {}) {
    if (!this.restClient) {
      throw new TradingError('REST 客戶端未初始化', 'CONNECTION_ERROR', 'bybit');
    }

    try {
      this.incrementRequestCount();
      
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await this.restClient.get(endpoint, params);
          break;
        case 'POST':
          response = await this.restClient.post(endpoint, params);
          break;
        case 'PUT':
          response = await this.restClient.put(endpoint, params);
          break;
        case 'DELETE':
          response = await this.restClient.delete(endpoint, params);
          break;
        default:
          throw new TradingError(`不支援的 HTTP 方法: ${method}`, 'INVALID_REQUEST', 'bybit');
      }

      return this.processResponse(response);
    } catch (error) {
      logger.error(`[BybitRest] ${method} ${endpoint} 請求失敗:`, error);
      throw error;
    }
  }

  processResponse(response) {
    if (response.retCode !== 0) {
      throw new TradingError(
        response.retMsg || 'API 請求失敗',
        'API_ERROR',
        'bybit',
        { retCode: response.retCode, retMsg: response.retMsg }
      );
    }
    return response.result;
  }
}

/**
 * Bybit 交易所主類
 */
class BybitExchange extends BaseExchange {
  constructor(config) {
    super({
      name: 'Bybit',
      ...config
    });
    
    this.restClient = null;
    this.wsClient = null;
  }

  async initialize() {
    try {
      // 創建公共數據客戶端（不需要 API 密鑰）
      this.publicRestClient = new RestClientV5({
        testnet: this.config.testnet || false
      });

      // 如果有 API 密鑰，初始化認證客戶端
      if (this.config.apiKey && this.config.secret) {
        this.restClient = new BybitRest(this.config);
        await this.restClient.initialize();

        // 初始化 WebSocket 客戶端
        this.wsClient = new BybitWebSocket(this.config);
        await this.wsClient.connect();
        // 設置 WebSocket 事件監聽
        this.setupWebSocketEventHandlers();
        logger.info('[BybitExchange] 完整模式初始化成功（包含 WebSocket）');
      } else {
        logger.info('[BybitExchange] 公共數據模式初始化成功（無需 API 密鑰）');
        this.publicOnly = true;
      }

      this.isConnected = true;
      this.isInitialized = true;
      return true;
    } catch (error) {
      logger.error('[BybitExchange] 初始化失敗:', error);
      this.isConnected = false;
      this.isInitialized = false;
      throw error;
    }
  }

  setupWebSocketEventHandlers() {
    if (!this.wsClient) return;

    this.wsClient.on('ticker', (data) => {
      this.tickerCache.set(data.symbol, data);
      this.emit('ticker', data);
    });

    this.wsClient.on('orderbook', (data) => {
      this.tickerCache.set(data.symbol, data);
      this.orderBookCache.set(data.symbol, data);
      this.emit('orderbook', data);
    });

    this.wsClient.on('position', (data) => {
      this.positionCache.set(data.symbol, data);
      this.emit('position', data);
    });

    this.wsClient.on('wallet', (data) => {
      this.balanceCache.set(data.currency, data);
      this.emit('wallet', data);
    });
  }

  async getAccountInfo() {
    try {
      const startTime = Date.now();
      
      // 獲取錢包餘額
      const walletResponse = await this.restClient.get('wallet/balance', {
        accountType: 'UNIFIED'
      });

      // 獲取持倉信息
      const positionResponse = await this.restClient.get('position/list', {
        category: 'linear'
      });

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      return {
        success: true,
        data: {
          balances: walletResponse?.list || [],
          positions: positionResponse?.list || []
        }
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] 獲取賬戶信息失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getOrderBook(symbol, category = 'linear') {
    try {
      const startTime = Date.now();
      
      // 使用公共 API 端點，不需要認證
      let response;
      if (this.publicRestClient) {
        // 使用公共客戶端
        response = await this.publicRestClient.get('v5/market/orderbook', {
          category: category,
          symbol: symbol,
          limit: 25
        });
      } else if (this.restClient) {
        // 使用認證客戶端
        response = await this.restClient.get('v5/market/orderbook', {
          category: category,
          symbol: symbol,
          limit: 25
        });
      } else {
        throw new Error('REST 客戶端未初始化');
      }

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] 獲取訂單簿失敗:', error);
      
      // 直接返回錯誤，不使用模擬數據
      return {
        success: false,
        error: error.message || '獲取訂單簿失敗',
        data: null
      };
    }
  }

  async placeOrder(orderParams) {
    try {
      const startTime = Date.now();
      
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

      const response = await this.restClient.post('order/create', orderData);

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      logger.trading('下單成功', { symbol, side, orderType, qty, category, result: response });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] 下單失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cancelOrder(symbol, orderId, category = 'linear') {
    try {
      const startTime = Date.now();
      
      const response = await this.restClient.post('order/cancel', {
        category: category,
        symbol: symbol,
        orderId: orderId
      });

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] 取消訂單失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async subscribeToTickers(symbols) {
    try {
      // 如果沒有 WebSocket 連接，在公共數據模式下跳過訂閱
      if (!this.wsClient || !this.wsClient.isWSConnected()) {
        if (!this.config.apiKey && !this.config.secret) {
          logger.info('[BybitExchange] 公共數據模式：跳過 WebSocket 訂閱');
          return true;
        }
        throw new TradingError('WebSocket 未連接', 'CONNECTION_ERROR', 'bybit');
      }

      const normalized = Array.isArray(symbols) ? symbols : [symbols];
      const subscribed = [];

      for (const entry of normalized) {
        const symbol = typeof entry === 'string' ? entry : entry.symbol;
        const category = typeof entry === 'string' ? 'linear' : (entry.category || 'linear');
        
        if (!symbol) continue;

        // 訂閱 tickers 和 orderbook
        await this.wsClient.subscribe(`tickers.${symbol}`, { category });
        await this.wsClient.subscribe(`orderbook.1.${symbol}`, { category });
        
        subscribed.push(`${symbol}@${category}`);
      }

      logger.info(`[BybitExchange] 已訂閱 tickers: ${subscribed.join(', ')}`);
      return true;
    } catch (error) {
      logger.error('[BybitExchange] 訂閱 tickers 失敗:', error);
      return false;
    }
  }

  async getInstruments(category = 'linear') {
    try {
      const startTime = Date.now();
      
      // 使用公共 API 端點
      let response;
      if (this.publicRestClient) {
        response = await this.publicRestClient.get('v5/market/instruments-info', {
          category: category
        });
      } else if (this.restClient) {
        response = await this.restClient.get('v5/market/instruments-info', {
          category: category
        });
      } else {
        throw new Error('REST 客戶端未初始化');
      }

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      return {
        success: true,
        data: response?.result?.list || []
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] 獲取交易對信息失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPosition(symbol) {
    try {
      const startTime = Date.now();
      
      const response = await this.restClient.get('position/list', {
        category: 'linear',
        symbol: symbol
      });

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      const positions = response?.list || [];
      const position = positions.find(p => p.symbol === symbol);

      return {
        success: true,
        data: position || null
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] 獲取持倉信息失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getBalance(currency) {
    try {
      const startTime = Date.now();
      
      const response = await this.restClient.get('wallet/balance', {
        accountType: 'UNIFIED',
        coin: currency
      });

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      const balances = response?.list || [];
      const balance = balances.find(b => b.coin === currency);

      return {
        success: true,
        data: balance || null
      };
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] 獲取餘額信息失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testConnection() {
    try {
      const startTime = Date.now();
      
      // 測試基本API連接
      const serverTimeResponse = await this.restClient.get('market/time');
      
      // 測試API權限
      const accountInfoResponse = await this.restClient.get('account/info');
      
      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      const accountInfo = accountInfoResponse;
      
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
        serverTime: serverTimeResponse.timeSecond,
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
    } catch (error) {
      this.updateStats(false);
      logger.error('[BybitExchange] API連接測試失敗:', error);
      
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

  async cleanup() {
    try {
      if (this.wsClient) {
        await this.wsClient.disconnect();
        this.wsClient = null;
      }
      
      this.restClient = null;
      this.isConnected = false;
      this.isInitialized = false;
      
      // 清理緩存
      this.tickerCache.clear();
      this.orderBookCache.clear();
      this.balanceCache.clear();
      this.positionCache.clear();
      
      logger.info('[BybitExchange] 交易所資源已清理');
    } catch (error) {
      logger.error('[BybitExchange] 清理資源失敗:', error);
    }
  }

  /**
   * 獲取可用交易對（兼容現有接口）
   */
  getAvailableSymbols(category = 'linear') {
    // 返回常用交易對列表
    const commonSymbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];
    return commonSymbols;
  }

  /**
   * 檢查是否已連接（兼容現有接口）
   */
  isExchangeConnected() {
    return this.isConnected && this.isInitialized;
  }

  /**
   * 獲取頂部報價（兼容現有接口）
   */
  getTopOfBook(symbol) {
    // 從緩存中獲取最新的價格數據
    const cached = this.tickerCache.get(symbol);
    if (cached) {
      return {
        symbol: symbol,
        exchange: 'bybit',
        bid1: cached.bid1,
        ask1: cached.ask1
      };
    }
    return null;
  }
}

module.exports = BybitExchange;
