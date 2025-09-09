/**
 * BybitExchange 單元測試
 */
const BybitExchange = require('../../../exchanges/bybit/BybitExchange');
const TradingError = require('../../../utils/TradingError');

// Mock bybit-api
jest.mock('bybit-api', () => ({
  RestClientV5: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  })),
  WebsocketClient: jest.fn().mockImplementation(() => ({
    subscribeV5: jest.fn(),
    unsubscribeV5: jest.fn(),
    closeAll: jest.fn(),
    on: jest.fn()
  }))
}));

describe('BybitExchange', () => {
  let exchange;
  let config;

  beforeEach(() => {
    config = {
      name: 'Bybit',
      apiKey: 'test_api_key',
      secret: 'test_secret',
      testnet: false
    };
    
    exchange = new BybitExchange(config);
  });

  afterEach(() => {
    if (exchange) {
      exchange.cleanup();
    }
  });

  describe('構造函數', () => {
    test('應該正確初始化配置', () => {
      expect(exchange.config.name).toBe('Bybit');
      expect(exchange.config.apiKey).toBe('test_api_key');
      expect(exchange.config.secret).toBe('test_secret');
      expect(exchange.config.testnet).toBe(false);
    });

    test('應該初始化默認狀態', () => {
      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
      expect(exchange.tickerCache).toBeInstanceOf(Map);
      expect(exchange.orderBookCache).toBeInstanceOf(Map);
    });
  });

  describe('initialize', () => {
    test('應該成功初始化', async () => {
      // Mock REST 客戶端初始化
      const mockRestClient = {
        initialize: jest.fn().mockResolvedValue(true),
        get: jest.fn(),
        post: jest.fn()
      };

      // Mock WebSocket 客戶端初始化
      const mockWsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        isWSConnected: jest.fn().mockReturnValue(true),
        subscribe: jest.fn().mockResolvedValue(true)
      };

      // 替換實例
      exchange.restClient = mockRestClient;
      exchange.wsClient = mockWsClient;

      const result = await exchange.initialize();

      expect(result).toBe(true);
      expect(exchange.isConnected).toBe(true);
      expect(exchange.isInitialized).toBe(true);
    });

    test('應該處理初始化失敗', async () => {
      // Mock 初始化失敗
      const mockRestClient = {
        initialize: jest.fn().mockRejectedValue(new Error('初始化失敗'))
      };

      exchange.restClient = mockRestClient;

      const result = await exchange.initialize();

      expect(result).toBe(false);
      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
    });
  });

  describe('getAccountInfo', () => {
    beforeEach(async () => {
      // 初始化交易所
      exchange.restClient = {
        get: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功獲取賬戶信息', async () => {
      const mockWalletResponse = { list: [{ coin: 'USDT', balance: '1000' }] };
      const mockPositionResponse = { list: [{ symbol: 'BTCUSDT', size: '0.1' }] };

      exchange.restClient.get
        .mockResolvedValueOnce(mockWalletResponse)
        .mockResolvedValueOnce(mockPositionResponse);

      const result = await exchange.getAccountInfo();

      expect(result.success).toBe(true);
      expect(result.data.balances).toEqual(mockWalletResponse.list);
      expect(result.data.positions).toEqual(mockPositionResponse.list);
      expect(exchange.stats.successfulRequests).toBe(1);
    });

    test('應該處理獲取賬戶信息失敗', async () => {
      exchange.restClient.get.mockRejectedValue(new Error('API 錯誤'));

      const result = await exchange.getAccountInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('API 錯誤');
      expect(exchange.stats.failedRequests).toBe(1);
    });
  });

  describe('getOrderBook', () => {
    beforeEach(async () => {
      exchange.restClient = {
        get: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功獲取訂單簿', async () => {
      const mockResponse = {
        s: 'BTCUSDT',
        b: [['50000', '1.5']],
        a: [['50001', '2.0']]
      };

      exchange.restClient.get.mockResolvedValue(mockResponse);

      const result = await exchange.getOrderBook('BTCUSDT', 'linear');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(exchange.restClient.get).toHaveBeenCalledWith('market/orderbook', {
        category: 'linear',
        symbol: 'BTCUSDT',
        limit: 25
      });
    });
  });

  describe('placeOrder', () => {
    beforeEach(async () => {
      exchange.restClient = {
        post: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功下市價單', async () => {
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'Buy',
        orderType: 'Market',
        qty: 0.1,
        category: 'linear'
      };

      const mockResponse = {
        orderId: '123456789',
        orderLinkId: 'test_order'
      };

      exchange.restClient.post.mockResolvedValue(mockResponse);

      const result = await exchange.placeOrder(orderParams);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(exchange.restClient.post).toHaveBeenCalledWith('order/create', {
        category: 'linear',
        symbol: 'BTCUSDT',
        side: 'Buy',
        orderType: 'Market',
        qty: '0.1'
      });
    });

    test('應該成功下限價單', async () => {
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'Buy',
        orderType: 'Limit',
        qty: 0.1,
        price: 50000,
        category: 'linear'
      };

      const mockResponse = {
        orderId: '123456789',
        orderLinkId: 'test_order'
      };

      exchange.restClient.post.mockResolvedValue(mockResponse);

      const result = await exchange.placeOrder(orderParams);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(exchange.restClient.post).toHaveBeenCalledWith('order/create', {
        category: 'linear',
        symbol: 'BTCUSDT',
        side: 'Buy',
        orderType: 'Limit',
        qty: '0.1',
        price: '50000'
      });
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async () => {
      exchange.restClient = {
        post: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功取消訂單', async () => {
      const mockResponse = {
        orderId: '123456789'
      };

      exchange.restClient.post.mockResolvedValue(mockResponse);

      const result = await exchange.cancelOrder('BTCUSDT', '123456789', 'linear');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(exchange.restClient.post).toHaveBeenCalledWith('order/cancel', {
        category: 'linear',
        symbol: 'BTCUSDT',
        orderId: '123456789'
      });
    });
  });

  describe('subscribeToTickers', () => {
    beforeEach(async () => {
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        isWSConnected: jest.fn().mockReturnValue(true),
        subscribe: jest.fn().mockResolvedValue(true)
      };
      await exchange.initialize();
    });

    test('應該成功訂閱單個交易對', async () => {
      const result = await exchange.subscribeToTickers('BTCUSDT');

      expect(result).toBe(true);
      expect(exchange.wsClient.subscribe).toHaveBeenCalledWith('tickers.BTCUSDT', { category: 'linear' });
      expect(exchange.wsClient.subscribe).toHaveBeenCalledWith('orderbook.1.BTCUSDT', { category: 'linear' });
    });

    test('應該成功訂閱多個交易對', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const result = await exchange.subscribeToTickers(symbols);

      expect(result).toBe(true);
      expect(exchange.wsClient.subscribe).toHaveBeenCalledTimes(4); // 2 symbols * 2 subscriptions each
    });

    test('應該處理 WebSocket 未連接的情況', async () => {
      exchange.wsClient.isWSConnected.mockReturnValue(false);

      const result = await exchange.subscribeToTickers('BTCUSDT');

      expect(result).toBe(false);
    });
  });

  describe('getInstruments', () => {
    beforeEach(async () => {
      exchange.restClient = {
        get: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功獲取交易對列表', async () => {
      const mockResponse = {
        list: [
          { symbol: 'BTCUSDT', status: 'Trading' },
          { symbol: 'ETHUSDT', status: 'Trading' }
        ]
      };

      exchange.restClient.get.mockResolvedValue(mockResponse);

      const result = await exchange.getInstruments('linear');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.list);
      expect(exchange.restClient.get).toHaveBeenCalledWith('market/instruments-info', {
        category: 'linear'
      });
    });
  });

  describe('getPosition', () => {
    beforeEach(async () => {
      exchange.restClient = {
        get: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功獲取持倉信息', async () => {
      const mockResponse = {
        list: [
          { symbol: 'BTCUSDT', size: '0.1', side: 'Buy' }
        ]
      };

      exchange.restClient.get.mockResolvedValue(mockResponse);

      const result = await exchange.getPosition('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.list[0]);
      expect(exchange.restClient.get).toHaveBeenCalledWith('position/list', {
        category: 'linear',
        symbol: 'BTCUSDT'
      });
    });

    test('應該處理無持倉的情況', async () => {
      const mockResponse = { list: [] };

      exchange.restClient.get.mockResolvedValue(mockResponse);

      const result = await exchange.getPosition('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('getBalance', () => {
    beforeEach(async () => {
      exchange.restClient = {
        get: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功獲取餘額信息', async () => {
      const mockResponse = {
        list: [
          { coin: 'USDT', balance: '1000', availableBalance: '1000' }
        ]
      };

      exchange.restClient.get.mockResolvedValue(mockResponse);

      const result = await exchange.getBalance('USDT');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.list[0]);
      expect(exchange.restClient.get).toHaveBeenCalledWith('wallet/balance', {
        accountType: 'UNIFIED',
        coin: 'USDT'
      });
    });
  });

  describe('testConnection', () => {
    beforeEach(async () => {
      exchange.restClient = {
        get: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();
    });

    test('應該成功測試連接', async () => {
      const mockServerTime = { timeSecond: 1640995200 };
      const mockAccountInfo = {
        marginMode: 'REGULAR_MARGIN',
        unifiedMarginStatus: 5,
        isMasterTrader: false,
        spotHedgingStatus: 'OFF',
        updatedTime: '1640995200000'
      };

      exchange.restClient.get
        .mockResolvedValueOnce(mockServerTime)
        .mockResolvedValueOnce(mockAccountInfo);

      const result = await exchange.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('API連接和權限測試成功');
      expect(result.serverTime).toBe(1640995200);
      expect(result.accountInfo.marginModeText).toBe('全倉保證金');
      expect(result.accountInfo.unifiedMarginStatusText).toBe('統一帳戶2.0');
    });

    test('應該處理連接測試失敗', async () => {
      exchange.restClient.get.mockRejectedValue(new Error('Invalid API key'));

      const result = await exchange.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('API密鑰無效');
      expect(result.suggestion).toBe('請檢查API Key是否正確');
    });
  });

  describe('cleanup', () => {
    test('應該正確清理資源', async () => {
      exchange.wsClient = {
        disconnect: jest.fn().mockResolvedValue(true)
      };
      exchange.restClient = {};
      exchange.tickerCache.set('BTCUSDT', { price: 50000 });
      exchange.orderBookCache.set('BTCUSDT', { bids: [] });
      exchange.balanceCache.set('USDT', { balance: 1000 });
      exchange.positionCache.set('BTCUSDT', { size: 0.1 });

      await exchange.cleanup();

      expect(exchange.wsClient.disconnect).toHaveBeenCalled();
      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
      expect(exchange.tickerCache.size).toBe(0);
      expect(exchange.orderBookCache.size).toBe(0);
      expect(exchange.balanceCache.size).toBe(0);
      expect(exchange.positionCache.size).toBe(0);
    });
  });

  describe('統計信息', () => {
    test('應該正確更新統計信息', async () => {
      exchange.restClient = {
        get: jest.fn().mockResolvedValue({})
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      await exchange.initialize();

      // 模擬成功請求
      await exchange.getAccountInfo();
      
      // 模擬失敗請求
      exchange.restClient.get.mockRejectedValue(new Error('API 錯誤'));
      await exchange.getAccountInfo();

      const stats = exchange.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
      expect(stats.successRate).toBe('50.00%');
    });
  });
});
