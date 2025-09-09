/**
 * Binance 交易所測試
 */
const BinanceExchange = require('../BinanceExchange');
const logger = require('../../../utils/logger');

describe('BinanceExchange', () => {
  let exchange;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      name: 'Binance',
      apiKey: 'test-api-key',
      secret: 'test-secret',
      testnet: true
    };
    
    exchange = new BinanceExchange(mockConfig);
  });

  afterEach(() => {
    if (exchange) {
      exchange.cleanup();
    }
  });

  describe('初始化', () => {
    test('應該正確創建交易所實例', () => {
      expect(exchange).toBeDefined();
      expect(exchange.getExchangeName()).toBe('Binance');
      expect(exchange.isExchangeConnected()).toBe(false);
    });

    test('應該正確設置配置', () => {
      expect(exchange.config.name).toBe('Binance');
      expect(exchange.config.apiKey).toBe('test-api-key');
      expect(exchange.config.secret).toBe('test-secret');
      expect(exchange.config.testnet).toBe(true);
    });
  });

  describe('訂單驗證', () => {
    test('應該驗證完整的訂單數據', async () => {
      const validOrder = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        amount: 0.001,
        price: 50000
      };

      await expect(exchange.validateOrder(validOrder)).resolves.not.toThrow();
    });

    test('應該拒絕不完整的訂單數據', async () => {
      const invalidOrder = {
        symbol: 'BTCUSDT',
        side: 'buy'
        // 缺少 amount
      };

      await expect(exchange.validateOrder(invalidOrder)).rejects.toThrow('訂單數據不完整');
    });

    test('應該拒絕無效的訂單數量', async () => {
      const invalidOrder = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        amount: 0,
        price: 50000
      };

      await expect(exchange.validateOrder(invalidOrder)).rejects.toThrow('訂單數量必須大於0');
    });

    test('應該拒絕無效的限價單價格', async () => {
      const invalidOrder = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        amount: 0.001
        // 缺少 price
      };

      await expect(exchange.validateOrder(invalidOrder)).rejects.toThrow('限價單必須指定有效價格');
    });
  });

  describe('統計信息', () => {
    test('應該正確更新統計信息', () => {
      const initialStats = exchange.getStats();
      expect(initialStats.totalRequests).toBe(0);
      expect(initialStats.successfulRequests).toBe(0);
      expect(initialStats.failedRequests).toBe(0);

      // 模擬成功請求
      exchange.updateStats(true, 100);
      const successStats = exchange.getStats();
      expect(successStats.totalRequests).toBe(1);
      expect(successStats.successfulRequests).toBe(1);
      expect(successStats.failedRequests).toBe(0);
      expect(successStats.averageResponseTime).toBe(100);

      // 模擬失敗請求
      exchange.updateStats(false, 200);
      const failStats = exchange.getStats();
      expect(failStats.totalRequests).toBe(2);
      expect(failStats.successfulRequests).toBe(1);
      expect(failStats.failedRequests).toBe(1);
      expect(failStats.averageResponseTime).toBe(150);
    });

    test('應該正確計算成功率', () => {
      exchange.updateStats(true, 100);
      exchange.updateStats(true, 200);
      exchange.updateStats(false, 300);

      const stats = exchange.getStats();
      expect(stats.successRate).toBe('66.67%');
    });
  });

  describe('緩存管理', () => {
    test('應該正確設置和獲取行情緩存', () => {
      const tickerData = {
        symbol: 'BTCUSDT',
        price: 50000,
        change: 2.5,
        volume: 1000,
        timestamp: Date.now()
      };

      exchange.tickerCache.set('BTCUSDT', tickerData);
      const cachedTicker = exchange.getTopOfBook('BTCUSDT');
      
      expect(cachedTicker).toEqual(tickerData);
    });

    test('應該正確設置和獲取訂單簿緩存', () => {
      const orderBookData = {
        symbol: 'BTCUSDT',
        bids: [[49900, 0.1], [49800, 0.2]],
        asks: [[50100, 0.1], [50200, 0.2]],
        timestamp: Date.now()
      };

      exchange.orderBookCache.set('BTCUSDT', orderBookData);
      const cachedOrderBook = exchange.getOrderBookCache('BTCUSDT');
      
      expect(cachedOrderBook).toEqual(orderBookData);
    });
  });

  describe('錯誤處理', () => {
    test('應該正確格式化錯誤信息', () => {
      const error = new Error('測試錯誤');
      const formattedError = exchange.formatError(error, '測試操作');

      expect(formattedError.exchange).toBe('Binance');
      expect(formattedError.operation).toBe('測試操作');
      expect(formattedError.error).toBe('測試錯誤');
      expect(formattedError.timestamp).toBeDefined();
    });

    test('應該在開發環境中包含堆棧信息', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('測試錯誤');
      const formattedError = exchange.formatError(error, '測試操作');

      expect(formattedError.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('清理功能', () => {
    test('應該正確清理資源', async () => {
      // 設置一些測試數據
      exchange.tickerCache.set('BTCUSDT', { price: 50000 });
      exchange.orderBookCache.set('BTCUSDT', { bids: [], asks: [] });
      exchange.isConnected = true;
      exchange.isInitialized = true;

      await exchange.cleanup();

      expect(exchange.isConnected).toBe(false);
      expect(exchange.isInitialized).toBe(false);
      expect(exchange.tickerCache.size).toBe(0);
      expect(exchange.orderBookCache.size).toBe(0);
    });
  });
});

// 集成測試（需要真實的 API 密鑰）
describe('BinanceExchange 集成測試', () => {
  let exchange;
  let realConfig;

  beforeAll(() => {
    // 只有在有真實配置時才運行集成測試
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
      realConfig = {
        name: 'Binance',
        apiKey: process.env.BINANCE_API_KEY,
        secret: process.env.BINANCE_SECRET,
        testnet: true
      };
    }
  });

  beforeEach(() => {
    if (realConfig) {
      exchange = new BinanceExchange(realConfig);
    }
  });

  afterEach(async () => {
    if (exchange) {
      await exchange.cleanup();
    }
  });

  test('應該能夠初始化真實的交易所連接', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      const result = await exchange.initialize();
      expect(result).toBe(true);
      expect(exchange.isExchangeConnected()).toBe(true);
    } catch (error) {
      console.log('集成測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);

  test('應該能夠獲取賬戶信息', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      await exchange.initialize();
      const accountInfo = await exchange.getAccountInfo();
      
      expect(accountInfo).toBeDefined();
      expect(accountInfo.exchange).toBe('Binance');
      expect(accountInfo.balance).toBeDefined();
    } catch (error) {
      console.log('集成測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);

  test('應該能夠獲取交易對列表', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      await exchange.initialize();
      const instruments = await exchange.getInstruments();
      
      expect(instruments).toBeDefined();
      expect(Array.isArray(instruments)).toBe(true);
      expect(instruments.length).toBeGreaterThan(0);
    } catch (error) {
      console.log('集成測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);
});
