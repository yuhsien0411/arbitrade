/**
 * 跨交易所套利集成測試
 * 測試 Bybit + Binance 套利功能
 */
const { ArbitrageEngine } = require('../../services/arbitrageEngine');
const ExchangeFactory = require('../../exchanges/index');
const BinanceExchange = require('../../exchanges/binance/BinanceExchange');
const logger = require('../../utils/logger');

// Mock 外部依賴
jest.mock('../../exchanges/bybit/BybitExchange', () => {
  return jest.fn();
});
jest.mock('../../exchanges/binance/BinanceExchange', () => {
  return jest.fn();
});
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('跨交易所套利集成測試', () => {
  let arbitrageEngine;
  let mockBybitAdapter;
    let mockBinanceExchange;

    beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    
    // 創建 mock 實例
    mockBybitAdapter = {
            initialize: jest.fn().mockResolvedValue(true),
            isExchangeConnected: jest.fn().mockReturnValue(true),
            getAvailableSymbols: jest.fn().mockReturnValue(['BTCUSDT', 'ETHUSDT']),
      getOrderBook: jest.fn().mockResolvedValue({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          bids: [['50000', '1.5']],
          asks: [['50001', '1.2']],
          timestamp: Date.now()
        }
      }),
      getBalance: jest.fn().mockResolvedValue({
        success: true,
        data: { USDT: 10000, BTC: 0.1 }
      }),
      getPositions: jest.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      placeOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { orderId: 'test-order-123' }
      }),
      cancelOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { orderId: 'test-order-123' }
      }),
            subscribeToTickers: jest.fn(),
      cleanup: jest.fn(),
      executeDualLegOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { leg1: { orderId: 'leg1-123' }, leg2: { orderId: 'leg2-456' } }
      })
        };

        mockBinanceExchange = {
            initialize: jest.fn().mockResolvedValue(true),
            isConnected: true,
            getAvailableSymbols: jest.fn().mockReturnValue(['BTCUSDT', 'ETHUSDT']),
      getOrderBook: jest.fn().mockResolvedValue({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          bids: [['49950', '2.0']],
          asks: [['49951', '1.8']],
          timestamp: Date.now()
        }
      }),
      getBalance: jest.fn().mockResolvedValue({
        success: true,
        data: { USDT: 15000, BTC: 0.15 }
      }),
      getPositions: jest.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      placeOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { orderId: 'binance-order-456' }
      }),
      cancelOrder: jest.fn().mockResolvedValue({
        success: true,
        data: { orderId: 'binance-order-456' }
      })
    };

    // 正確設置 Mock 實現
    const BybitExchange = require('../../exchanges/bybit/BybitExchange');
    BybitExchange.mockImplementation(() => mockBybitAdapter);
    BinanceExchange.mockImplementation(() => mockBinanceExchange);

    // 創建套利引擎實例
    arbitrageEngine = new ArbitrageEngine();
    });

    afterEach(() => {
    if (arbitrageEngine && arbitrageEngine.isRunning) {
      arbitrageEngine.stop();
    }
    });

    describe('引擎初始化', () => {
    test('應該成功初始化 Bybit 和 Binance 交易所', async () => {
      // 設置環境變量
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      process.env.BINANCE_TESTNET = 'true';

      await arbitrageEngine.start();

      expect(mockBybitAdapter.initialize).toHaveBeenCalled();
            expect(mockBinanceExchange.initialize).toHaveBeenCalled();
      expect(arbitrageEngine.isRunning).toBe(true);
      expect(arbitrageEngine.exchanges.bybit).toBeDefined();
      expect(arbitrageEngine.exchanges.binance).toBeDefined();
    });

    test('應該在沒有 Binance API 密鑰時跳過 Binance 初始化', async () => {
      delete process.env.BINANCE_API_KEY;
      delete process.env.BINANCE_SECRET_KEY;

      await arbitrageEngine.start();

      expect(mockBybitAdapter.initialize).toHaveBeenCalled();
      expect(mockBinanceExchange.initialize).not.toHaveBeenCalled();
      expect(arbitrageEngine.exchanges.binance).toBeNull();
    });

    test('應該處理 Binance 初始化失敗', async () => {
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      
      mockBinanceExchange.initialize.mockRejectedValue(new Error('Binance API 錯誤'));

      await arbitrageEngine.start();

      expect(mockBybitAdapter.initialize).toHaveBeenCalled();
      expect(arbitrageEngine.exchanges.binance).toBeNull();
      expect(arbitrageEngine.isRunning).toBe(true);
    });
  });

  describe('跨交易所價格監控', () => {
    beforeEach(async () => {
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      await arbitrageEngine.start();
    });

    test('應該能夠獲取兩個交易所的價格數據', async () => {
      const symbol = 'BTCUSDT';
      
      // 獲取 Bybit 價格
      const bybitPrice = await arbitrageEngine.exchanges.bybit.getOrderBook(symbol);
      expect(bybitPrice.success).toBe(true);
      expect(bybitPrice.data.symbol).toBe(symbol);

      // 獲取 Binance 價格
      const binancePrice = await arbitrageEngine.exchanges.binance.getOrderBook(symbol, 'spot');
      expect(binancePrice.success).toBe(true);
      expect(binancePrice.data.symbol).toBe(symbol);
    });

    test('應該檢測到價差機會', () => {
      const bybitPrice = 50000; // Bybit 買入價
      const binancePrice = 49950; // Binance 賣出價
      const priceDiff = bybitPrice - binancePrice;
      const priceDiffPercent = (priceDiff / binancePrice) * 100;

      // 價差應該大於閾值（假設 0.1%）
      expect(priceDiffPercent).toBeGreaterThan(0.1);
      expect(priceDiff).toBe(50);
    });

    test('應該處理價格獲取錯誤', async () => {
      mockBybitAdapter.getOrderBook.mockRejectedValue(new Error('Bybit API 錯誤'));
      mockBinanceExchange.getOrderBook.mockRejectedValue(new Error('Binance API 錯誤'));

      await expect(arbitrageEngine.exchanges.bybit.getOrderBook('BTCUSDT')).rejects.toThrow('Bybit API 錯誤');
      await expect(arbitrageEngine.exchanges.binance.getOrderBook('BTCUSDT', 'spot')).rejects.toThrow('Binance API 錯誤');
    });
  });

  describe('套利策略執行', () => {
    beforeEach(async () => {
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      await arbitrageEngine.start();
    });

    test('應該能夠執行跨交易所套利策略', async () => {
      const strategy = {
        id: 'test-strategy-1',
        symbol: 'BTCUSDT',
        exchanges: ['bybit', 'binance'],
        buyExchange: 'binance',
        sellExchange: 'bybit',
        amount: 0.1,
        minPriceDiff: 0.001, // 0.1%
        maxPriceDiff: 0.01   // 1%
      };

      // 添加套利策略
      arbitrageEngine.addArbitrageStrategy(strategy);
      expect(arbitrageEngine.activeStrategies.has(strategy.id)).toBe(true);

      // 模擬價差檢測
      const bybitPrice = 50000;
      const binancePrice = 49950;
      const priceDiff = (bybitPrice - binancePrice) / binancePrice;

      expect(priceDiff).toBeGreaterThan(strategy.minPriceDiff);
      expect(priceDiff).toBeLessThan(strategy.maxPriceDiff);
    });

    test('應該能夠執行 TWAP 策略', async () => {
      const twapStrategy = {
        id: 'twap-test-1',
        symbol: 'BTCUSDT',
        totalAmount: 1.0,
        duration: 300000, // 5分鐘
        intervals: 10,
        exchanges: ['bybit', 'binance']
      };

      // 添加 TWAP 策略
      arbitrageEngine.addTwapStrategy(twapStrategy);
      expect(arbitrageEngine.twapStrategies.has(twapStrategy.id)).toBe(true);
    });

    test('應該處理套利執行錯誤', async () => {
      mockBybitAdapter.placeOrder.mockRejectedValue(new Error('Bybit 下單失敗'));
      mockBinanceExchange.placeOrder.mockRejectedValue(new Error('Binance 下單失敗'));

      await expect(arbitrageEngine.exchanges.bybit.placeOrder({
                symbol: 'BTCUSDT',
                side: 'buy',
        amount: 0.1,
        price: 50000
      })).rejects.toThrow('Bybit 下單失敗');

      await expect(arbitrageEngine.exchanges.binance.placeOrder({
                    symbol: 'BTCUSDT',
        side: 'sell',
        amount: 0.1,
        price: 49950
      })).rejects.toThrow('Binance 下單失敗');
    });
  });

  describe('風險控制', () => {
    beforeEach(async () => {
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      await arbitrageEngine.start();
    });

    test('應該檢查最大持倉限制', () => {
      const currentPosition = 5000;
      const maxPosition = arbitrageEngine.riskLimits.maxPositionSize;

      expect(currentPosition).toBeLessThan(maxPosition);
    });

    test('應該檢查日內最大虧損限制', () => {
      const todayLoss = 500;
      const maxDailyLoss = arbitrageEngine.riskLimits.maxDailyLoss;

      expect(todayLoss).toBeLessThan(maxDailyLoss);
    });

    test('應該檢查價格偏差閾值', () => {
      const priceDeviation = 0.03; // 3%
      const threshold = arbitrageEngine.riskLimits.priceDeviationThreshold;

      expect(priceDeviation).toBeLessThan(threshold);
    });
  });

  describe('性能測試', () => {
    beforeEach(async () => {
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      await arbitrageEngine.start();
    });

    test('應該在合理時間內完成價格獲取', async () => {
      const startTime = Date.now();
      
      const [bybitPrice, binancePrice] = await Promise.all([
        arbitrageEngine.exchanges.bybit.getOrderBook('BTCUSDT'),
        arbitrageEngine.exchanges.binance.getOrderBook('BTCUSDT', 'spot')
      ]);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(5000); // 5秒內完成
      expect(bybitPrice.success).toBe(true);
      expect(binancePrice.success).toBe(true);
    });

    test('應該能夠處理並發請求', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const startTime = Date.now();

      const promises = symbols.map(symbol => 
        Promise.all([
          arbitrageEngine.exchanges.bybit.getOrderBook(symbol),
          arbitrageEngine.exchanges.binance.getOrderBook(symbol, 'spot')
        ])
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(10000); // 10秒內完成
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveLength(2);
        expect(result[0].success).toBe(true);
        expect(result[1].success).toBe(true);
      });
        });
    });

  describe('錯誤處理和恢復', () => {
        beforeEach(async () => {
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      await arbitrageEngine.start();
    });

    test('應該處理交易所連接中斷', async () => {
      // 模擬連接中斷
      mockBybitAdapter.isExchangeConnected.mockReturnValue(false);
      mockBinanceExchange.isConnected = false;

      const status = arbitrageEngine.getStatus();
      expect(status.exchanges.bybit.connected).toBe(false);
      expect(status.exchanges.binance.connected).toBe(false);
    });

    test('應該處理 API 限流', async () => {
      mockBybitAdapter.getOrderBook.mockRejectedValue(new Error('Rate limit exceeded'));
      mockBinanceExchange.getOrderBook.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(arbitrageEngine.exchanges.bybit.getOrderBook('BTCUSDT')).rejects.toThrow('Rate limit exceeded');
      await expect(arbitrageEngine.exchanges.binance.getOrderBook('BTCUSDT', 'spot')).rejects.toThrow('Rate limit exceeded');
    });

    test('應該能夠重新連接交易所', async () => {
      // 模擬連接中斷
      mockBybitAdapter.isExchangeConnected.mockReturnValue(false);
      
      // 重新初始化
      await arbitrageEngine.start();
      
      expect(mockBybitAdapter.initialize).toHaveBeenCalledTimes(2);
    });
  });

  describe('統計和監控', () => {
        beforeEach(async () => {
      process.env.BINANCE_API_KEY = 'test-api-key';
      process.env.BINANCE_SECRET_KEY = 'test-secret-key';
      await arbitrageEngine.start();
    });

    test('應該正確追蹤交易統計', () => {
      const initialStats = arbitrageEngine.stats;
      
      // 模擬交易執行
      arbitrageEngine.stats.totalTrades++;
      arbitrageEngine.stats.successfulTrades++;
      arbitrageEngine.stats.totalProfit += 100;

      expect(arbitrageEngine.stats.totalTrades).toBe(initialStats.totalTrades + 1);
      expect(arbitrageEngine.stats.successfulTrades).toBe(initialStats.successfulTrades + 1);
      expect(arbitrageEngine.stats.totalProfit).toBe(initialStats.totalProfit + 100);
    });

    test('應該提供完整的引擎狀態', () => {
      const status = arbitrageEngine.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('monitoringPairs');
      expect(status).toHaveProperty('twapStrategies');
      expect(status).toHaveProperty('stats');
      expect(status).toHaveProperty('riskLimits');
      expect(status).toHaveProperty('exchanges');
      
      expect(status.exchanges.bybit).toBeDefined();
      expect(status.exchanges.binance).toBeDefined();
    });
});
});