/**
 * BybitExchange 簡化單元測試
 */
const BybitExchange = require('../../../exchanges/bybit/BybitExchange');

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

describe('BybitExchange - 簡化測試', () => {
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

  describe('通用方法', () => {
    test('isExchangeConnected 應該返回正確狀態', () => {
      expect(exchange.isExchangeConnected()).toBe(false);
      
      exchange.isConnected = true;
      exchange.isInitialized = true;
      expect(exchange.isExchangeConnected()).toBe(true);
    });

    test('getExchangeName 應該返回交易所名稱', () => {
      expect(exchange.getExchangeName()).toBe('Bybit');
    });

    test('getTopOfBook 應該返回緩存的價格數據', () => {
      const mockData = { bid1: { price: 50000 }, ask1: { price: 50001 } };
      exchange.tickerCache.set('BTCUSDT', mockData);
      
      expect(exchange.getTopOfBook('BTCUSDT')).toEqual(mockData);
      expect(exchange.getTopOfBook('ETHUSDT')).toBeNull();
    });

    test('updateStats 應該正確更新統計信息', () => {
      exchange.updateStats(true, 100);
      exchange.updateStats(false, 200);
      
      expect(exchange.stats.totalRequests).toBe(2);
      expect(exchange.stats.successfulRequests).toBe(1);
      expect(exchange.stats.failedRequests).toBe(1);
      expect(exchange.stats.averageResponseTime).toBe(150);
    });

    test('getStats 應該返回格式化的統計信息', () => {
      exchange.updateStats(true, 100);
      exchange.updateStats(false, 200);
      
      const stats = exchange.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successRate).toBe('50.00%');
    });
  });

  describe('抽象方法', () => {
    test('未初始化的方法應該返回錯誤', async () => {
      // 由於我們沒有初始化，這些方法應該返回錯誤
      const accountResult = await exchange.getAccountInfo();
      expect(accountResult.success).toBe(false);
      expect(accountResult.error).toBeDefined();
      
      const orderBookResult = await exchange.getOrderBook('BTCUSDT');
      expect(orderBookResult.success).toBe(false);
      expect(orderBookResult.error).toBeDefined();
      
      const orderResult = await exchange.placeOrder({});
      expect(orderResult.success).toBe(false);
      expect(orderResult.error).toBeDefined();
    });
  });

  describe('cleanup', () => {
    test('應該正確清理資源', async () => {
      exchange.tickerCache.set('BTCUSDT', { price: 50000 });
      exchange.orderBookCache.set('BTCUSDT', { bids: [] });
      exchange.balanceCache.set('USDT', { balance: 1000 });
      exchange.positionCache.set('BTCUSDT', { size: 0.1 });
      
      await exchange.cleanup();
      
      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
      expect(exchange.tickerCache.size).toBe(0);
      expect(exchange.orderBookCache.size).toBe(0);
      expect(exchange.balanceCache.size).toBe(0);
      expect(exchange.positionCache.size).toBe(0);
    });
  });

  describe('錯誤處理', () => {
    test('應該正確格式化錯誤信息', () => {
      const error = new Error('測試錯誤');
      const formattedError = exchange.formatError(error, '測試操作');
      
      expect(formattedError.exchange).toBe('Bybit');
      expect(formattedError.operation).toBe('測試操作');
      expect(formattedError.error).toBe('測試錯誤');
      expect(formattedError.timestamp).toBeDefined();
    });
  });
});
