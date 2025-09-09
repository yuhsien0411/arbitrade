/**
 * BybitExchange 性能基準測試
 */
const BybitExchange = require('../../../exchanges/bybit/BybitExchange');

// Mock bybit-api
jest.mock('bybit-api', () => ({
  RestClientV5: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({ retCode: 0, result: { timeSecond: Date.now() } }),
    post: jest.fn().mockResolvedValue({ retCode: 0, result: { orderId: '123456' } })
  })),
  WebsocketClient: jest.fn().mockImplementation(() => ({
    subscribeV5: jest.fn(),
    unsubscribeV5: jest.fn(),
    closeAll: jest.fn(),
    on: jest.fn()
  }))
}));

describe('BybitExchange - 性能基準測試', () => {
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

  describe('初始化性能', () => {
    test('初始化時間應該在合理範圍內', async () => {
      const startTime = Date.now();
      
      // Mock 客戶端
      exchange.restClient = {
        initialize: jest.fn().mockResolvedValue(true),
        get: jest.fn(),
        post: jest.fn()
      };
      exchange.wsClient = {
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };

      await exchange.initialize();
      
      const endTime = Date.now();
      const initTime = endTime - startTime;
      
      // 初始化時間應該小於 1000ms
      expect(initTime).toBeLessThan(1000);
      expect(exchange.isInitialized).toBe(true);
    });
  });

  describe('統計信息性能', () => {
    test('統計信息更新應該高效', () => {
      const startTime = Date.now();
      
      // 執行 1000 次統計更新
      for (let i = 0; i < 1000; i++) {
        exchange.updateStats(i % 2 === 0, Math.random() * 100);
      }
      
      const endTime = Date.now();
      const updateTime = endTime - startTime;
      
      // 1000 次更新應該小於 100ms
      expect(updateTime).toBeLessThan(100);
      expect(exchange.stats.totalRequests).toBe(1000);
    });

    test('獲取統計信息應該快速', () => {
      // 先更新一些統計信息
      for (let i = 0; i < 100; i++) {
        exchange.updateStats(i % 2 === 0, Math.random() * 100);
      }

      const startTime = Date.now();
      
      // 執行 1000 次統計信息獲取
      for (let i = 0; i < 1000; i++) {
        const stats = exchange.getStats();
        expect(stats.totalRequests).toBe(100);
      }
      
      const endTime = Date.now();
      const getTime = endTime - startTime;
      
      // 1000 次獲取應該小於 100ms
      expect(getTime).toBeLessThan(100);
    });
  });

  describe('緩存性能', () => {
    test('緩存操作應該高效', () => {
      const startTime = Date.now();
      
      // 執行 1000 次緩存操作
      for (let i = 0; i < 1000; i++) {
        const symbol = `SYMBOL${i % 100}`;
        const data = {
          bid1: { price: 50000 + i, amount: 1.0 },
          ask1: { price: 50001 + i, amount: 1.0 },
          ts: Date.now()
        };
        
        exchange.tickerCache.set(symbol, data);
        const retrieved = exchange.getTopOfBook(symbol);
        expect(retrieved).toEqual(data);
      }
      
      const endTime = Date.now();
      const cacheTime = endTime - startTime;
      
      // 1000 次緩存操作應該小於 100ms
      expect(cacheTime).toBeLessThan(100);
      expect(exchange.tickerCache.size).toBe(100);
    });

    test('緩存清理應該快速', () => {
      // 先填充緩存
      for (let i = 0; i < 1000; i++) {
        exchange.tickerCache.set(`SYMBOL${i}`, { price: 50000 });
        exchange.orderBookCache.set(`SYMBOL${i}`, { bids: [] });
        exchange.balanceCache.set(`CURRENCY${i}`, { balance: 1000 });
        exchange.positionCache.set(`SYMBOL${i}`, { size: 0.1 });
      }

      const startTime = Date.now();
      
      // 清理緩存
      exchange.tickerCache.clear();
      exchange.orderBookCache.clear();
      exchange.balanceCache.clear();
      exchange.positionCache.clear();
      
      const endTime = Date.now();
      const clearTime = endTime - startTime;
      
      // 清理操作應該小於 10ms
      expect(clearTime).toBeLessThan(10);
      expect(exchange.tickerCache.size).toBe(0);
      expect(exchange.orderBookCache.size).toBe(0);
      expect(exchange.balanceCache.size).toBe(0);
      expect(exchange.positionCache.size).toBe(0);
    });
  });

  describe('錯誤處理性能', () => {
    test('錯誤格式化應該快速', () => {
      const startTime = Date.now();
      
      // 執行 1000 次錯誤格式化
      for (let i = 0; i < 1000; i++) {
        const error = new Error(`測試錯誤 ${i}`);
        const formatted = exchange.formatError(error, `操作${i}`);
        
        expect(formatted.exchange).toBe('Bybit');
        expect(formatted.operation).toBe(`操作${i}`);
        expect(formatted.error).toBe(`測試錯誤 ${i}`);
      }
      
      const endTime = Date.now();
      const formatTime = endTime - startTime;
      
      // 1000 次錯誤格式化應該小於 200ms
      expect(formatTime).toBeLessThan(200);
    });
  });

  describe('內存使用', () => {
    test('大量數據操作後內存使用應該合理', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 創建大量數據
      for (let i = 0; i < 10000; i++) {
        exchange.tickerCache.set(`SYMBOL${i}`, {
          bid1: { price: 50000 + i, amount: 1.0 },
          ask1: { price: 50001 + i, amount: 1.0 },
          ts: Date.now()
        });
      }
      
      const afterDataMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterDataMemory - initialMemory;
      
      // 內存增長應該小於 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      // 清理數據
      exchange.tickerCache.clear();
      
      const afterCleanupMemory = process.memoryUsage().heapUsed;
      const memoryAfterCleanup = afterCleanupMemory - initialMemory;
      
      // 清理後內存應該接近初始值
      expect(memoryAfterCleanup).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('並發性能', () => {
    test('並發統計更新應該正確', async () => {
      const promises = [];
      
      // 創建 100 個並發統計更新
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              exchange.updateStats(i % 2 === 0, Math.random() * 100);
              resolve();
            }, Math.random() * 10);
          })
        );
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      
      // 並發操作應該小於 200ms
      expect(endTime - startTime).toBeLessThan(200);
      expect(exchange.stats.totalRequests).toBe(100);
    });
  });
});
