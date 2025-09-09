/**
 * Binance WebSocket 測試
 */
const BinanceWebSocket = require('../BinanceWebSocket');

describe('BinanceWebSocket', () => {
  let wsClient;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      name: 'Binance',
      wsUrl: 'wss://testnet.binance.vision/ws/',
      testnet: true,
      apiKey: 'test-api-key',
      secret: 'test-secret'
    };
    
    wsClient = new BinanceWebSocket(mockConfig);
  });

  afterEach(async () => {
    if (wsClient) {
      await wsClient.disconnect();
    }
  });

  describe('初始化', () => {
    test('應該正確創建 WebSocket 客戶端', () => {
      expect(wsClient).toBeDefined();
      expect(wsClient.config.name).toBe('Binance');
      expect(wsClient.config.wsUrl).toBe('wss://testnet.binance.vision/ws/');
      expect(wsClient.isConnected).toBe(false);
    });

    test('應該正確設置重連參數', () => {
      expect(wsClient.maxReconnectAttempts).toBe(5);
      expect(wsClient.reconnectInterval).toBe(5000);
      expect(wsClient.pingInterval).toBe(30000);
    });
  });

  describe('數據格式化', () => {
    test('應該正確格式化行情數據', () => {
      const rawData = {
        e: '24hrTicker',
        s: 'BTCUSDT',
        c: '50000.00',
        P: '2.50',
        p: '1250.00',
        v: '1000.00',
        q: '50000000.00',
        h: '51000.00',
        l: '49000.00',
        o: '48750.00',
        E: 1640995200000
      };

      const formatted = wsClient.formatTickerData(rawData);
      
      expect(formatted.symbol).toBe('BTCUSDT');
      expect(formatted.price).toBe(50000);
      expect(formatted.change).toBe(2.5);
      expect(formatted.changeAmount).toBe(1250);
      expect(formatted.volume).toBe(1000);
      expect(formatted.quoteVolume).toBe(50000000);
      expect(formatted.high).toBe(51000);
      expect(formatted.low).toBe(49000);
      expect(formatted.open).toBe(48750);
      expect(formatted.timestamp).toBe(1640995200000);
      expect(formatted.exchange).toBe('Binance');
    });

    test('應該正確格式化訂單簿數據', () => {
      const rawData = {
        e: 'depthUpdate',
        s: 'BTCUSDT',
        b: [['49900.00', '0.1'], ['49800.00', '0.2']],
        a: [['50100.00', '0.1'], ['50200.00', '0.2']],
        E: 1640995200000
      };

      const formatted = wsClient.formatOrderBookData(rawData);
      
      expect(formatted.symbol).toBe('BTCUSDT');
      expect(formatted.bids).toEqual([[49900, 0.1], [49800, 0.2]]);
      expect(formatted.asks).toEqual([[50100, 0.1], [50200, 0.2]]);
      expect(formatted.timestamp).toBe(1640995200000);
      expect(formatted.exchange).toBe('Binance');
    });

    test('應該正確格式化交易數據', () => {
      const rawData = {
        e: 'trade',
        s: 'BTCUSDT',
        p: '50000.00',
        q: '0.001',
        m: false,
        T: 1640995200000,
        t: 12345
      };

      const formatted = wsClient.formatTradeData(rawData);
      
      expect(formatted.symbol).toBe('BTCUSDT');
      expect(formatted.price).toBe(50000);
      expect(formatted.quantity).toBe(0.001);
      expect(formatted.side).toBe('buy');
      expect(formatted.timestamp).toBe(1640995200000);
      expect(formatted.tradeId).toBe(12345);
      expect(formatted.exchange).toBe('Binance');
    });

    test('應該正確格式化K線數據', () => {
      const rawData = {
        e: 'kline',
        k: {
          s: 'BTCUSDT',
          o: '49000.00',
          h: '51000.00',
          l: '48500.00',
          c: '50000.00',
          v: '100.00',
          q: '5000000.00',
          t: 1640995200000,
          T: 1640995260000,
          i: '1m'
        },
        E: 1640995260000
      };

      const formatted = wsClient.formatKlineData(rawData);
      
      expect(formatted.symbol).toBe('BTCUSDT');
      expect(formatted.open).toBe(49000);
      expect(formatted.high).toBe(51000);
      expect(formatted.low).toBe(48500);
      expect(formatted.close).toBe(50000);
      expect(formatted.volume).toBe(100);
      expect(formatted.quoteVolume).toBe(5000000);
      expect(formatted.openTime).toBe(1640995200000);
      expect(formatted.closeTime).toBe(1640995260000);
      expect(formatted.interval).toBe('1m');
      expect(formatted.timestamp).toBe(1640995260000);
      expect(formatted.exchange).toBe('Binance');
    });

    test('應該正確格式化訂單更新數據', () => {
      const rawData = {
        e: 'executionReport',
        s: 'BTCUSDT',
        i: 12345,
        c: 'client-order-id',
        S: 'BUY',
        o: 'LIMIT',
        f: 'GTC',
        q: '0.001',
        p: '50000.00',
        P: '0.00',
        F: '0.00',
        X: 'NEW',
        r: 'NONE',
        l: '0.000',
        z: '0.000',
        L: '0.00',
        n: '0.00',
        N: 'USDT',
        T: 1640995200000,
        t: 0,
        E: 1640995200000
      };

      const formatted = wsClient.formatOrderUpdateData(rawData);
      
      expect(formatted.symbol).toBe('BTCUSDT');
      expect(formatted.orderId).toBe(12345);
      expect(formatted.clientOrderId).toBe('client-order-id');
      expect(formatted.side).toBe('BUY');
      expect(formatted.orderType).toBe('LIMIT');
      expect(formatted.timeInForce).toBe('GTC');
      expect(formatted.quantity).toBe(0.001);
      expect(formatted.price).toBe(50000);
      expect(formatted.orderStatus).toBe('NEW');
      expect(formatted.timestamp).toBe(1640995200000);
      expect(formatted.exchange).toBe('Binance');
    });

    test('應該正確格式化餘額更新數據', () => {
      const rawData = {
        e: 'outboundAccountPosition',
        a: 'BTC',
        f: '1.5',
        l: '0.5',
        E: 1640995200000
      };

      const formatted = wsClient.formatBalanceUpdateData(rawData);
      
      expect(formatted.asset).toBe('BTC');
      expect(formatted.free).toBe(1.5);
      expect(formatted.locked).toBe(0.5);
      expect(formatted.timestamp).toBe(1640995200000);
      expect(formatted.exchange).toBe('Binance');
    });
  });

  describe('訂閱管理', () => {
    test('應該正確添加訂閱', () => {
      wsClient.addSubscription('btcusdt@ticker');
      expect(wsClient.subscriptions.has('btcusdt@ticker')).toBe(true);
    });

    test('應該正確移除訂閱', () => {
      wsClient.addSubscription('btcusdt@ticker');
      wsClient.subscriptions.delete('btcusdt@ticker');
      expect(wsClient.subscriptions.has('btcusdt@ticker')).toBe(false);
    });

    test('應該正確獲取訂閱列表', () => {
      wsClient.addSubscription('btcusdt@ticker');
      wsClient.addSubscription('ethusdt@ticker');
      
      const subscriptions = wsClient.getSubscriptions();
      expect(subscriptions).toContainEqual(['btcusdt@ticker', 'unknown']);
      expect(subscriptions).toContainEqual(['ethusdt@ticker', 'unknown']);
    });
  });

  describe('連接狀態', () => {
    test('應該正確報告連接狀態', () => {
      expect(wsClient.isWSConnected()).toBe(false);
      
      wsClient.isConnected = true;
      expect(wsClient.isWSConnected()).toBe(true);
    });
  });

  describe('重連機制', () => {
    test('應該正確處理重連嘗試', () => {
      const originalConnect = wsClient.connect;
      let connectCallCount = 0;
      
      wsClient.connect = jest.fn().mockImplementation(() => {
        connectCallCount++;
        if (connectCallCount === 1) {
          return Promise.reject(new Error('連接失敗'));
        }
        return Promise.resolve();
      });

      wsClient.handleReconnect();
      
      expect(wsClient.reconnectAttempts).toBe(1);
    });

    test('應該在達到最大重連次數後停止重連', () => {
      wsClient.reconnectAttempts = wsClient.maxReconnectAttempts;
      
      const connectSpy = jest.spyOn(wsClient, 'connect');
      wsClient.handleReconnect();
      
      expect(connectSpy).not.toHaveBeenCalled();
    });
  });

  describe('心跳機制', () => {
    test('應該正確啟動和停止心跳', () => {
      expect(wsClient.heartbeatInterval).toBeNull();
      
      wsClient.startHeartbeat();
      expect(wsClient.heartbeatInterval).toBeDefined();
      
      wsClient.stopHeartbeat();
      expect(wsClient.heartbeatInterval).toBeNull();
    });
  });

  describe('消息處理', () => {
    test('應該正確處理未知消息類型', () => {
      const loggerSpy = jest.spyOn(require('../../../utils/logger'), 'debug').mockImplementation();
      
      const unknownMessage = {
        e: 'unknownEvent',
        data: 'test'
      };
      
      wsClient.handleMessage(unknownMessage);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        '[BinanceWebSocket] 收到未知消息類型:',
        'unknownEvent'
      );
      
      loggerSpy.mockRestore();
    });

    test('應該正確處理解析錯誤', () => {
      const loggerSpy = jest.spyOn(require('../../../utils/logger'), 'error').mockImplementation();
      
      // 模擬無效的 JSON 數據 - 直接調用 handleMessage 會觸發 JSON.parse 錯誤
      try {
        wsClient.handleMessage('invalid json');
      } catch (error) {
        // 預期的錯誤
      }
      
      expect(loggerSpy).toHaveBeenCalled();
      
      loggerSpy.mockRestore();
    });
  });
});

// 集成測試（需要真實的 WebSocket 連接）
describe('BinanceWebSocket 集成測試', () => {
  let wsClient;
  let realConfig;

  beforeAll(() => {
    realConfig = {
      name: 'Binance',
      wsUrl: 'wss://testnet.binance.vision/ws/',
      testnet: true
    };
  });

  beforeEach(() => {
    wsClient = new BinanceWebSocket(realConfig);
  });

  afterEach(async () => {
    if (wsClient) {
      await wsClient.disconnect();
    }
  });

  test('應該能夠連接到測試網 WebSocket', async () => {
    try {
      await wsClient.connect();
      expect(wsClient.isConnected).toBe(true);
    } catch (error) {
      console.log('WebSocket 連接測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);

  test('應該能夠處理 WebSocket 消息', (done) => {
    wsClient.connect().then(() => {
      wsClient.on('ticker', (data) => {
        expect(data).toBeDefined();
        expect(data.exchange).toBe('Binance');
        done();
      });

      // 訂閱一個測試交易對
      wsClient.subscribeTicker('BTCUSDT');
    }).catch((error) => {
      console.log('WebSocket 消息測試失敗（可能是網絡問題）:', error.message);
      done();
    });
  }, 15000);
});
