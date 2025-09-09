/**
 * Binance WebSocket 客戶端
 * 繼承自 BaseWebSocket，實現所有抽象方法
 */
const BaseWebSocket = require('../base/BaseWebSocket');
const WebSocket = require('ws');
const crypto = require('crypto');
const logger = require('../../utils/logger');

class BinanceWebSocket extends BaseWebSocket {
  constructor(config) {
    super({
      name: 'Binance',
      wsUrl: config.testnet ? 'wss://testnet.binance.vision/ws/' : 'wss://stream.binance.com:9443/ws/',
      ...config
    });
    
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;
    this.heartbeatInterval = null;
    this.pingInterval = 30000; // 30秒發送一次ping
  }

  /**
   * 建立 WebSocket 連接
   */
  async connect() {
    try {
      this.wsClient = new WebSocket(this.wsUrl);
      
      // 設置事件監聽
      this.setupEventHandlers();
      
      // 等待連接建立
      await this.waitForConnection();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // 啟動心跳機制
      this.startHeartbeat();
      
      logger.info('[BinanceWebSocket] 連接成功');
      
    } catch (error) {
      logger.error('[BinanceWebSocket] 連接失敗:', error);
      throw error;
    }
  }

  /**
   * 設置事件監聽
   */
  setupEventHandlers() {
    this.wsClient.on('open', () => {
      logger.info('[BinanceWebSocket] WebSocket 連接已建立');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.wsClient.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (error) {
        logger.error('[BinanceWebSocket] 消息解析失敗:', error);
      }
    });

    this.wsClient.on('error', (error) => {
      logger.error('[BinanceWebSocket] WebSocket 錯誤:', error);
      this.emit('error', error);
    });

    this.wsClient.on('close', (code, reason) => {
      logger.warn(`[BinanceWebSocket] WebSocket 連接已關閉 (${code}): ${reason}`);
      this.isConnected = false;
      this.stopHeartbeat();
      this.handleReconnect();
    });

    this.wsClient.on('pong', () => {
      logger.debug('[BinanceWebSocket] 收到 pong 響應');
    });
  }

  /**
   * 等待連接建立
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket 連接超時'));
      }, 10000);

      this.wsClient.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.wsClient.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 處理 WebSocket 消息
   */
  handleMessage(message) {
    try {
      // 處理不同類型的消息
      if (message.e === '24hrTicker') {
        // 處理24小時行情數據
        this.emit('ticker', this.formatTickerData(message));
      } else if (message.e === 'depthUpdate') {
        // 處理訂單簿數據
        this.emit('orderbook', this.formatOrderBookData(message));
      } else if (message.e === 'trade') {
        // 處理交易數據
        this.emit('trade', this.formatTradeData(message));
      } else if (message.e === 'kline') {
        // 處理K線數據
        this.emit('kline', this.formatKlineData(message));
      } else if (message.e === 'executionReport') {
        // 處理訂單執行報告
        this.emit('orderUpdate', this.formatOrderUpdateData(message));
      } else if (message.e === 'outboundAccountPosition') {
        // 處理賬戶餘額更新
        this.emit('balanceUpdate', this.formatBalanceUpdateData(message));
      } else {
        logger.debug('[BinanceWebSocket] 收到未知消息類型:', message.e);
      }
    } catch (error) {
      logger.error('[BinanceWebSocket] 消息處理失敗:', error);
    }
  }

  /**
   * 訂閱行情
   */
  subscribeTicker(symbol) {
    try {
      const streamName = `${symbol.toLowerCase()}@ticker`;
      this.subscribe(streamName);
      this.subscriptions.set(streamName, 'ticker');
      
      logger.info(`[BinanceWebSocket] 訂閱行情: ${symbol}`);
    } catch (error) {
      logger.error(`[BinanceWebSocket] 訂閱行情失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 訂閱訂單簿
   */
  subscribeOrderBook(symbol, level = 20) {
    try {
      const streamName = `${symbol.toLowerCase()}@depth${level}@100ms`;
      this.subscribe(streamName);
      this.subscriptions.set(streamName, 'orderbook');
      
      logger.info(`[BinanceWebSocket] 訂閱訂單簿: ${symbol} (level: ${level})`);
    } catch (error) {
      logger.error(`[BinanceWebSocket] 訂閱訂單簿失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 訂閱交易
   */
  subscribeTrades(symbol) {
    try {
      const streamName = `${symbol.toLowerCase()}@trade`;
      this.subscribe(streamName);
      this.subscriptions.set(streamName, 'trade');
      
      logger.info(`[BinanceWebSocket] 訂閱交易: ${symbol}`);
    } catch (error) {
      logger.error(`[BinanceWebSocket] 訂閱交易失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 訂閱K線數據
   */
  subscribeKline(symbol, interval = '1m') {
    try {
      const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
      this.subscribe(streamName);
      this.subscriptions.set(streamName, 'kline');
      
      logger.info(`[BinanceWebSocket] 訂閱K線: ${symbol} (${interval})`);
    } catch (error) {
      logger.error(`[BinanceWebSocket] 訂閱K線失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 訂閱用戶數據流（需要認證）
   */
  async subscribeUserData() {
    try {
      if (!this.config.apiKey || !this.config.secret) {
        throw new Error('用戶數據流需要 API 密鑰');
      }

      // 創建監聽密鑰
      const listenKey = await this.createListenKey();
      
      // 訂閱用戶數據流
      const streamName = `${listenKey}`;
      this.subscribe(streamName);
      this.subscriptions.set(streamName, 'userData');
      
      // 定期更新監聽密鑰
      this.startListenKeyRefresh(listenKey);
      
      logger.info('[BinanceWebSocket] 訂閱用戶數據流成功');
    } catch (error) {
      logger.error('[BinanceWebSocket] 訂閱用戶數據流失敗:', error);
      throw error;
    }
  }

  /**
   * 取消訂閱
   */
  unsubscribe(symbol) {
    try {
      // 取消所有與該交易對相關的訂閱
      for (const [streamName, type] of this.subscriptions) {
        if (streamName.includes(symbol.toLowerCase())) {
          this.unsubscribe(streamName);
          this.subscriptions.delete(streamName);
        }
      }
      
      logger.info(`[BinanceWebSocket] 取消訂閱: ${symbol}`);
    } catch (error) {
      logger.error(`[BinanceWebSocket] 取消訂閱失敗 ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 訂閱數據流
   */
  subscribe(streamName) {
    if (!this.isConnected) {
      throw new Error('WebSocket 未連接');
    }
    
    // Binance 使用單一 WebSocket 連接，通過 URL 參數訂閱多個流
    // 這裡我們需要重新連接以添加新的訂閱
    this.addSubscription(streamName);
  }

  /**
   * 添加訂閱到列表
   */
  addSubscription(streamName) {
    this.subscriptions.set(streamName, 'unknown');
  }

  /**
   * 取消訂閱數據流
   */
  unsubscribe(streamName) {
    if (!this.isConnected) {
      return;
    }
    
    this.subscriptions.delete(streamName);
  }

  /**
   * 處理重連
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[BinanceWebSocket] 重連次數已達上限');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`[BinanceWebSocket] 嘗試重連 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(error => {
        logger.error('[BinanceWebSocket] 重連失敗:', error);
      });
    }, this.reconnectInterval);
  }

  /**
   * 啟動心跳機制
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.wsClient) {
        this.wsClient.ping();
      }
    }, this.pingInterval);
  }

  /**
   * 停止心跳機制
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 創建監聽密鑰
   */
  async createListenKey() {
    const axios = require('axios');
    const response = await axios.post('https://api.binance.com/api/v3/userDataStream', {}, {
      headers: {
        'X-MBX-APIKEY': this.config.apiKey
      }
    });
    return response.data.listenKey;
  }

  /**
   * 更新監聽密鑰
   */
  async updateListenKey(listenKey) {
    const axios = require('axios');
    await axios.put('https://api.binance.com/api/v3/userDataStream', {
      listenKey: listenKey
    }, {
      headers: {
        'X-MBX-APIKEY': this.config.apiKey
      }
    });
  }

  /**
   * 啟動監聽密鑰刷新
   */
  startListenKeyRefresh(listenKey) {
    // 每30分鐘刷新一次監聽密鑰
    setInterval(async () => {
      try {
        await this.updateListenKey(listenKey);
        logger.info('[BinanceWebSocket] 監聽密鑰已刷新');
      } catch (error) {
        logger.error('[BinanceWebSocket] 刷新監聽密鑰失敗:', error);
      }
    }, 30 * 60 * 1000);
  }

  /**
   * 斷開連接
   */
  async disconnect() {
    try {
      this.stopHeartbeat();
      
      if (this.wsClient) {
        this.wsClient.close();
        this.wsClient = null;
      }
      
      this.isConnected = false;
      this.subscriptions.clear();
      
      logger.info('[BinanceWebSocket] 連接已斷開');
    } catch (error) {
      logger.error('[BinanceWebSocket] 斷開連接失敗:', error);
    }
  }

  /**
   * 格式化行情數據
   */
  formatTickerData(data) {
    return {
      symbol: data.s,
      price: parseFloat(data.c),
      change: parseFloat(data.P),
      changeAmount: parseFloat(data.p),
      volume: parseFloat(data.v),
      quoteVolume: parseFloat(data.q),
      high: parseFloat(data.h),
      low: parseFloat(data.l),
      open: parseFloat(data.o),
      timestamp: data.E,
      exchange: 'Binance'
    };
  }

  /**
   * 格式化訂單簿數據
   */
  formatOrderBookData(data) {
    return {
      symbol: data.s,
      bids: data.b.map(bid => [parseFloat(bid[0]), parseFloat(bid[1])]),
      asks: data.a.map(ask => [parseFloat(ask[0]), parseFloat(ask[1])]),
      timestamp: data.E,
      exchange: 'Binance'
    };
  }

  /**
   * 格式化交易數據
   */
  formatTradeData(data) {
    return {
      symbol: data.s,
      price: parseFloat(data.p),
      quantity: parseFloat(data.q),
      side: data.m ? 'sell' : 'buy',
      timestamp: data.T,
      tradeId: data.t,
      exchange: 'Binance'
    };
  }

  /**
   * 格式化K線數據
   */
  formatKlineData(data) {
    const kline = data.k;
    return {
      symbol: kline.s,
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c),
      volume: parseFloat(kline.v),
      quoteVolume: parseFloat(kline.q),
      openTime: kline.t,
      closeTime: kline.T,
      interval: kline.i,
      timestamp: data.E,
      exchange: 'Binance'
    };
  }

  /**
   * 格式化訂單更新數據
   */
  formatOrderUpdateData(data) {
    return {
      symbol: data.s,
      orderId: data.i,
      clientOrderId: data.c,
      side: data.S,
      orderType: data.o,
      timeInForce: data.f,
      quantity: parseFloat(data.q),
      price: parseFloat(data.p),
      stopPrice: parseFloat(data.P),
      icebergQuantity: parseFloat(data.F),
      orderStatus: data.X,
      orderRejectReason: data.r,
      lastExecutedQuantity: parseFloat(data.l),
      cumulativeFilledQuantity: parseFloat(data.z),
      lastExecutedPrice: parseFloat(data.L),
      commission: parseFloat(data.n),
      commissionAsset: data.N,
      transactionTime: data.T,
      tradeId: data.t,
      timestamp: data.E,
      exchange: 'Binance'
    };
  }

  /**
   * 格式化餘額更新數據
   */
  formatBalanceUpdateData(data) {
    return {
      asset: data.a,
      free: parseFloat(data.f),
      locked: parseFloat(data.l),
      timestamp: data.E,
      exchange: 'Binance'
    };
  }
}

module.exports = BinanceWebSocket;
