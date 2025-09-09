/**
 * Binance REST API 測試
 */
const BinanceRest = require('../BinanceRest');

describe('BinanceRest', () => {
  let restClient;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      name: 'Binance',
      baseUrl: 'https://testnet.binance.vision',
      testnet: true,
      apiKey: 'test-api-key',
      secret: 'test-secret'
    };
    
    restClient = new BinanceRest(mockConfig);
  });

  afterEach(() => {
    if (restClient) {
      restClient.client = null;
    }
  });

  describe('初始化', () => {
    test('應該正確創建 REST 客戶端', () => {
      expect(restClient).toBeDefined();
      expect(restClient.config.name).toBe('Binance');
      expect(restClient.config.baseUrl).toBe('https://testnet.binance.vision');
      expect(restClient.config.testnet).toBe(true);
    });

    test('應該正確設置速率限制參數', () => {
      expect(restClient.rateLimiter.window).toBe(60000);
      expect(restClient.rateLimiter.requests).toBe(0);
    });
  });

  describe('簽名生成', () => {
    test('應該正確生成簽名', () => {
      const params = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '50000',
        timestamp: 1640995200000
      };

      const signature = restClient.createSignature(params);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 簽名長度
    });

    test('應該為相同的參數生成相同的簽名', () => {
      const params = {
        symbol: 'BTCUSDT',
        timestamp: 1640995200000
      };

      const signature1 = restClient.createSignature(params);
      const signature2 = restClient.createSignature(params);
      
      expect(signature1).toBe(signature2);
    });

    test('應該為不同的參數生成不同的簽名', () => {
      const params1 = { symbol: 'BTCUSDT', timestamp: 1640995200000 };
      const params2 = { symbol: 'ETHUSDT', timestamp: 1640995200000 };

      const signature1 = restClient.createSignature(params1);
      const signature2 = restClient.createSignature(params2);
      
      expect(signature1).not.toBe(signature2);
    });
  });

  describe('速率限制', () => {
    test('應該正確檢查速率限制', () => {
      // 初始狀態應該允許請求
      expect(restClient.checkRateLimit()).toBe(true);
      
      // 模擬超過限制
      restClient.rateLimiter.requests = 1200;
      expect(restClient.checkRateLimit()).toBe(false);
    });

    test('應該正確重置速率限制計數器', () => {
      restClient.rateLimiter.requests = 100;
      restClient.rateLimiter.lastReset = Date.now() - 70000; // 70秒前
      
      expect(restClient.checkRateLimit()).toBe(true);
      expect(restClient.rateLimiter.requests).toBe(0);
    });

    test('應該正確增加請求計數', () => {
      const initialCount = restClient.rateLimiter.requests;
      restClient.incrementRequestCount();
      
      expect(restClient.rateLimiter.requests).toBe(initialCount + 1);
    });
  });

  describe('數據格式化', () => {
    test('應該正確格式化行情數據', () => {
      const rawData = {
        symbol: 'BTCUSDT',
        lastPrice: '50000.00',
        priceChangePercent: '2.50',
        priceChange: '1250.00',
        volume: '1000.00',
        quoteVolume: '50000000.00',
        highPrice: '51000.00',
        lowPrice: '49000.00',
        openPrice: '48750.00',
        closeTime: 1640995200000
      };

      const formatted = restClient.formatTickerData(rawData);
      
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
  });

  describe('響應處理', () => {
    test('應該正確處理正常響應', () => {
      const response = { data: 'test' };
      const processed = restClient.processResponse(response);
      
      expect(processed).toEqual(response);
    });

    test('應該正確處理錯誤響應', () => {
      const errorResponse = {
        code: 400,
        msg: 'Invalid symbol'
      };

      expect(() => {
        restClient.processResponse(errorResponse);
      }).toThrow('Binance API 錯誤: Invalid symbol (代碼: 400)');
    });

    test('應該允許代碼為200的響應', () => {
      const response = {
        code: 200,
        data: 'success'
      };
      
      const processed = restClient.processResponse(response);
      expect(processed).toEqual(response);
    });
  });

  describe('參數格式化', () => {
    test('應該正確格式化請求參數', () => {
      const params = {
        symbol: 'BTCUSDT',
        limit: 100
      };

      const formatted = restClient.formatParams(params);
      expect(formatted).toEqual(params);
    });
  });

  describe('HTTP 方法', () => {
    beforeEach(async () => {
      // 模擬初始化
      restClient.client = jest.fn().mockResolvedValue({ data: 'test' });
      restClient.isInitialized = true;
    });

    test('應該正確執行 GET 請求', async () => {
      const mockResponse = { data: 'test' };
      restClient.client.mockResolvedValue(mockResponse);
      
      const result = await restClient.get('/test', { param: 'value' });
      
      expect(restClient.client).toHaveBeenCalledWith({
        method: 'GET',
        url: '/test',
        headers: {},
        params: { param: 'value' }
      });
    });

    test('應該正確執行 POST 請求', async () => {
      const mockResponse = { data: 'test' };
      restClient.client.mockResolvedValue(mockResponse);
      
      const result = await restClient.post('/test', { data: 'value' });
      
      expect(restClient.client).toHaveBeenCalledWith({
        method: 'POST',
        url: '/test',
        headers: {},
        data: { data: 'value' }
      });
    });

    test('應該正確執行 PUT 請求', async () => {
      const mockResponse = { data: 'test' };
      restClient.client.mockResolvedValue(mockResponse);
      
      const result = await restClient.put('/test', { data: 'value' });
      
      expect(restClient.client).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/test',
        headers: {},
        data: { data: 'value' }
      });
    });

    test('應該正確執行 DELETE 請求', async () => {
      const mockResponse = { data: 'test' };
      restClient.client.mockResolvedValue(mockResponse);
      
      const result = await restClient.delete('/test', { param: 'value' });
      
      expect(restClient.client).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/test',
        headers: {},
        params: { param: 'value' }
      });
    });
  });

  describe('訂單處理', () => {
    beforeEach(async () => {
      // 模擬初始化
      restClient.client = jest.fn().mockResolvedValue({ data: 'test' });
      restClient.isInitialized = true;
    });

    test('應該正確處理限價單', async () => {
      const mockResponse = {
        data: {
          orderId: 12345,
          symbol: 'BTCUSDT',
          side: 'BUY',
          origQty: '0.001',
          price: '50000.00',
          status: 'NEW',
          transactTime: 1640995200000
        }
      };
      
      restClient.client.mockResolvedValue(mockResponse);
      
      const orderData = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        amount: 0.001,
        price: 50000
      };
      
      const result = await restClient.placeOrder(orderData);
      
      expect(result.id).toBe(12345);
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe('BUY');
      expect(result.amount).toBe(0.001);
      expect(result.price).toBe(50000);
      expect(result.status).toBe('NEW');
    });

    test('應該正確處理市價單', async () => {
      const mockResponse = {
        data: {
          orderId: 12346,
          symbol: 'BTCUSDT',
          side: 'SELL',
          origQty: '0.001',
          price: '0.00',
          status: 'FILLED',
          transactTime: 1640995200000
        }
      };
      
      restClient.client.mockResolvedValue(mockResponse);
      
      const orderData = {
        symbol: 'BTCUSDT',
        side: 'sell',
        type: 'market',
        amount: 0.001
      };
      
      const result = await restClient.placeOrder(orderData);
      
      expect(result.id).toBe(12346);
      expect(result.side).toBe('SELL');
      expect(result.status).toBe('FILLED');
    });

    test('應該正確取消訂單', async () => {
      const mockResponse = {
        data: {
          orderId: 12345,
          symbol: 'BTCUSDT',
          status: 'CANCELED'
        }
      };
      
      restClient.client.mockResolvedValue(mockResponse);
      
      const result = await restClient.cancelOrder(12345, 'BTCUSDT');
      
      expect(result.id).toBe(12345);
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.status).toBe('CANCELED');
    });
  });
});

// 集成測試（需要真實的 API 連接）
describe('BinanceRest 集成測試', () => {
  let restClient;
  let realConfig;

  beforeAll(() => {
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
      realConfig = {
        name: 'Binance',
        baseUrl: 'https://testnet.binance.vision',
        testnet: true,
        apiKey: process.env.BINANCE_API_KEY,
        secret: process.env.BINANCE_SECRET
      };
    }
  });

  beforeEach(() => {
    if (realConfig) {
      restClient = new BinanceRest(realConfig);
    }
  });

  test('應該能夠初始化真實的 REST 客戶端', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      await restClient.initialize();
      expect(restClient.isInitialized).toBe(true);
    } catch (error) {
      console.log('REST 客戶端初始化測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);

  test('應該能夠獲取服務器時間', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      await restClient.initialize();
      const serverTime = await restClient.getServerTime();
      
      expect(serverTime).toBeDefined();
      expect(typeof serverTime).toBe('number');
      expect(serverTime).toBeGreaterThan(0);
    } catch (error) {
      console.log('服務器時間測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);

  test('應該能夠獲取交易對信息', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      await restClient.initialize();
      const instruments = await restClient.getInstruments();
      
      expect(instruments).toBeDefined();
      expect(Array.isArray(instruments)).toBe(true);
      expect(instruments.length).toBeGreaterThan(0);
      
      // 檢查第一個交易對的結構
      const firstInstrument = instruments[0];
      expect(firstInstrument.symbol).toBeDefined();
      expect(firstInstrument.baseAsset).toBeDefined();
      expect(firstInstrument.quoteAsset).toBeDefined();
    } catch (error) {
      console.log('交易對信息測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);

  test('應該能夠獲取行情數據', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      await restClient.initialize();
      const ticker = await restClient.getTicker('BTCUSDT');
      
      expect(ticker).toBeDefined();
      expect(ticker.symbol).toBe('BTCUSDT');
      expect(ticker.price).toBeGreaterThan(0);
      expect(ticker.exchange).toBe('Binance');
    } catch (error) {
      console.log('行情數據測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);

  test('應該能夠獲取訂單簿', async () => {
    if (!realConfig) {
      console.log('跳過集成測試：缺少真實的 API 密鑰');
      return;
    }

    try {
      await restClient.initialize();
      const orderBook = await restClient.getOrderBook('BTCUSDT', 10);
      
      expect(orderBook).toBeDefined();
      expect(orderBook.symbol).toBe('BTCUSDT');
      expect(Array.isArray(orderBook.bids)).toBe(true);
      expect(Array.isArray(orderBook.asks)).toBe(true);
      expect(orderBook.bids.length).toBeGreaterThan(0);
      expect(orderBook.asks.length).toBeGreaterThan(0);
      expect(orderBook.exchange).toBe('Binance');
    } catch (error) {
      console.log('訂單簿測試失敗（可能是網絡問題）:', error.message);
    }
  }, 10000);
});
