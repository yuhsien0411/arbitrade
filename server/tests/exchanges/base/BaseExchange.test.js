/**
 * BaseExchange 單元測試
 */
const BaseExchange = require('../../../exchanges/base/BaseExchange');
const TradingError = require('../../../utils/TradingError');

describe('BaseExchange', () => {
  let exchange;
  let config;

  beforeEach(() => {
    config = {
      name: 'TestExchange',
      apiKey: 'test_key',
      secret: 'test_secret',
      testnet: true
    };
    
    // 創建測試用的子類
    class TestExchange extends BaseExchange {
      async initialize() { return true; }
      async getAccountInfo() { return { balance: 1000 }; }
      async getOrderBook(symbol, category) { return { bids: [], asks: [] }; }
      async placeOrder(orderParams) { return { orderId: '123' }; }
      async cancelOrder(symbol, orderId, category) { return { success: true }; }
      async subscribeToTickers(symbols) { return true; }
      async getInstruments(category) { return []; }
      async getPosition(symbol) { return { size: 0 }; }
      async getBalance(currency) { return { free: 1000 }; }
    }
    
    exchange = new TestExchange(config);
  });

  describe('構造函數', () => {
    test('應該正確初始化配置', () => {
      expect(exchange.config.name).toBe('TestExchange');
      expect(exchange.config.apiKey).toBe('test_key');
      expect(exchange.config.secret).toBe('test_secret');
      expect(exchange.config.testnet).toBe(true);
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
      expect(exchange.getExchangeName()).toBe('TestExchange');
    });

    test('getTopOfBook 應該返回緩存的價格數據', () => {
      const mockData = { bid1: { price: 100 }, ask1: { price: 101 } };
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
    test('未實現的抽象方法應該拋出錯誤', async () => {
      const abstractExchange = new BaseExchange(config);
      
      await expect(abstractExchange.initialize()).rejects.toThrow('initialize() method must be implemented by subclass');
      await expect(abstractExchange.getAccountInfo()).rejects.toThrow('getAccountInfo() method must be implemented by subclass');
      await expect(abstractExchange.getOrderBook('BTCUSDT')).rejects.toThrow('getOrderBook() method must be implemented by subclass');
      await expect(abstractExchange.placeOrder({})).rejects.toThrow('placeOrder() method must be implemented by subclass');
    });
  });

  describe('testConnection', () => {
    test('應該成功測試連接', async () => {
      const result = await exchange.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('TestExchange');
      expect(result.data).toEqual({ balance: 1000 });
    });

    test('應該處理連接失敗', async () => {
      // 創建會失敗的交易所
      class FailingExchange extends BaseExchange {
        async initialize() { return true; }
        async getAccountInfo() { throw new Error('Connection failed'); }
        async getOrderBook() { throw new Error('Not implemented'); }
        async placeOrder() { throw new Error('Not implemented'); }
        async cancelOrder() { throw new Error('Not implemented'); }
        async subscribeToTickers() { throw new Error('Not implemented'); }
        async getInstruments() { throw new Error('Not implemented'); }
        async getPosition() { throw new Error('Not implemented'); }
        async getBalance() { throw new Error('Not implemented'); }
      }
      
      const failingExchange = new FailingExchange(config);
      const result = await failingExchange.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('連接測試失敗');
    });
  });

  describe('cleanup', () => {
    test('應該正確清理資源', async () => {
      exchange.tickerCache.set('BTCUSDT', { price: 100 });
      exchange.orderBookCache.set('BTCUSDT', { bids: [] });
      exchange.balanceCache.set('USDT', { free: 1000 });
      exchange.positionCache.set('BTCUSDT', { size: 1 });
      
      await exchange.cleanup();
      
      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
      expect(exchange.tickerCache.size).toBe(0);
      expect(exchange.orderBookCache.size).toBe(0);
      expect(exchange.balanceCache.size).toBe(0);
      expect(exchange.positionCache.size).toBe(0);
    });
  });
});
