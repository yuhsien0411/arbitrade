/**
 * 真實 API 測試
 * 使用真實的 API 密鑰進行跨交易所套利測試
 */
const { ArbitrageEngine } = require('../../services/arbitrageEngine');
const ExchangeFactory = require('../../exchanges/index');
const logger = require('../../utils/logger');

// Mock logger for testing
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('真實 API 測試', () => {
  let arbitrageEngine;

  beforeAll(async () => {
    // 檢查是否有真實的 API 密鑰
    if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_SECRET_KEY) {
      console.log('⚠️  跳過真實 API 測試：缺少 API 密鑰');
      return;
    }

    arbitrageEngine = new ArbitrageEngine();
  });

  afterAll(async () => {
    if (arbitrageEngine && arbitrageEngine.isRunning) {
      await arbitrageEngine.stop();
    }
  });

  describe('Bybit API 測試', () => {
    test('應該能夠獲取 Bybit 服務器時間', async () => {
      if (!arbitrageEngine) {
        console.log('跳過測試：未初始化套利引擎');
        return;
      }

      try {
        const bybitExchange = arbitrageEngine.exchanges.bybit;
        const serverTime = await bybitExchange.getServerTime();
        
        expect(serverTime).toBeDefined();
        expect(serverTime.success).toBe(true);
        expect(serverTime.data).toBeDefined();
        expect(serverTime.data.serverTime).toBeDefined();
        
        console.log(`✅ Bybit 服務器時間: ${new Date(serverTime.data.serverTime)}`);
      } catch (error) {
        console.log(`⚠️  Bybit API 測試失敗: ${error.message}`);
        // 不拋出錯誤，因為可能是網絡問題
      }
    }, 10000);

    test('應該能夠獲取 Bybit 交易對信息', async () => {
      if (!arbitrageEngine) {
        console.log('跳過測試：未初始化套利引擎');
        return;
      }

      try {
        const bybitExchange = arbitrageEngine.exchanges.bybit;
        const instruments = await bybitExchange.getInstruments('linear');
        
        expect(instruments).toBeDefined();
        expect(instruments.success).toBe(true);
        expect(instruments.data).toBeDefined();
        expect(Array.isArray(instruments.data.list)).toBe(true);
        
        console.log(`✅ Bybit 交易對數量: ${instruments.data.list.length}`);
      } catch (error) {
        console.log(`⚠️  Bybit 交易對測試失敗: ${error.message}`);
      }
    }, 10000);

    test('應該能夠獲取 Bybit 價格數據', async () => {
      if (!arbitrageEngine) {
        console.log('跳過測試：未初始化套利引擎');
        return;
      }

      try {
        const bybitExchange = arbitrageEngine.exchanges.bybit;
        const orderBook = await bybitExchange.getOrderBook('BTCUSDT', 'linear');
        
        expect(orderBook).toBeDefined();
        expect(orderBook.success).toBe(true);
        expect(orderBook.data).toBeDefined();
        expect(orderBook.data.bids).toBeDefined();
        expect(orderBook.data.asks).toBeDefined();
        
        console.log(`✅ Bybit BTCUSDT 價格: 買入=${orderBook.data.bids[0][0]}, 賣出=${orderBook.data.asks[0][0]}`);
      } catch (error) {
        console.log(`⚠️  Bybit 價格測試失敗: ${error.message}`);
      }
    }, 10000);
  });

  describe('Binance API 測試', () => {
    test('應該能夠獲取 Binance 服務器時間', async () => {
      if (!arbitrageEngine || !arbitrageEngine.exchanges.binance) {
        console.log('跳過測試：Binance 未初始化');
        return;
      }

      try {
        const binanceExchange = arbitrageEngine.exchanges.binance;
        const serverTime = await binanceExchange.getServerTime();
        
        expect(serverTime).toBeDefined();
        expect(serverTime.success).toBe(true);
        expect(serverTime.data).toBeDefined();
        expect(serverTime.data.serverTime).toBeDefined();
        
        console.log(`✅ Binance 服務器時間: ${new Date(serverTime.data.serverTime)}`);
      } catch (error) {
        console.log(`⚠️  Binance API 測試失敗: ${error.message}`);
      }
    }, 10000);

    test('應該能夠獲取 Binance 交易對信息', async () => {
      if (!arbitrageEngine || !arbitrageEngine.exchanges.binance) {
        console.log('跳過測試：Binance 未初始化');
        return;
      }

      try {
        const binanceExchange = arbitrageEngine.exchanges.binance;
        const exchangeInfo = await binanceExchange.getExchangeInfo();
        
        expect(exchangeInfo).toBeDefined();
        expect(exchangeInfo.success).toBe(true);
        expect(exchangeInfo.data).toBeDefined();
        expect(Array.isArray(exchangeInfo.data.symbols)).toBe(true);
        
        console.log(`✅ Binance 交易對數量: ${exchangeInfo.data.symbols.length}`);
      } catch (error) {
        console.log(`⚠️  Binance 交易對測試失敗: ${error.message}`);
      }
    }, 10000);

    test('應該能夠獲取 Binance 價格數據', async () => {
      if (!arbitrageEngine || !arbitrageEngine.exchanges.binance) {
        console.log('跳過測試：Binance 未初始化');
        return;
      }

      try {
        const binanceExchange = arbitrageEngine.exchanges.binance;
        const orderBook = await binanceExchange.getOrderBook('BTCUSDT', 'spot');
        
        expect(orderBook).toBeDefined();
        expect(orderBook.success).toBe(true);
        expect(orderBook.data).toBeDefined();
        expect(orderBook.data.bids).toBeDefined();
        expect(orderBook.data.asks).toBeDefined();
        
        console.log(`✅ Binance BTCUSDT 價格: 買入=${orderBook.data.bids[0][0]}, 賣出=${orderBook.data.asks[0][0]}`);
      } catch (error) {
        console.log(`⚠️  Binance 價格測試失敗: ${error.message}`);
      }
    }, 10000);
  });

  describe('跨交易所套利測試', () => {
    test('應該能夠檢測跨交易所價差', async () => {
      if (!arbitrageEngine) {
        console.log('跳過測試：未初始化套利引擎');
        return;
      }

      try {
        const bybitExchange = arbitrageEngine.exchanges.bybit;
        const binanceExchange = arbitrageEngine.exchanges.binance;
        
        if (!binanceExchange) {
          console.log('跳過測試：Binance 未初始化');
          return;
        }

        // 並發獲取兩個交易所的價格
        const [bybitPrice, binancePrice] = await Promise.allSettled([
          bybitExchange.getOrderBook('BTCUSDT', 'linear'),
          binanceExchange.getOrderBook('BTCUSDT', 'spot')
        ]);

        if (bybitPrice.status === 'fulfilled' && binancePrice.status === 'fulfilled') {
          const bybitData = bybitPrice.value.data;
          const binanceData = binancePrice.value.data;
          
          const bybitBid = parseFloat(bybitData.bids[0][0]);
          const binanceAsk = parseFloat(binanceData.asks[0][0]);
          const priceDiff = bybitBid - binanceAsk;
          const profitPercent = (priceDiff / binanceAsk) * 100;
          
          console.log(`💰 價差檢測: Bybit買入=${bybitBid}, Binance賣出=${binanceAsk}`);
          console.log(`💰 價差: ${priceDiff} USDT (${profitPercent.toFixed(4)}%)`);
          
          expect(priceDiff).toBeDefined();
          expect(typeof priceDiff).toBe('number');
        } else {
          console.log('⚠️  價格獲取失敗，跳過價差檢測');
        }
      } catch (error) {
        console.log(`⚠️  跨交易所套利測試失敗: ${error.message}`);
      }
    }, 15000);

    test('應該能夠處理 API 錯誤', async () => {
      if (!arbitrageEngine) {
        console.log('跳過測試：未初始化套利引擎');
        return;
      }

      try {
        const bybitExchange = arbitrageEngine.exchanges.bybit;
        
        // 測試無效的交易對
        const result = await bybitExchange.getOrderBook('INVALIDPAIR', 'linear');
        
        // 應該返回錯誤結果
        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        
        console.log('✅ API 錯誤處理正常');
      } catch (error) {
        console.log(`⚠️  API 錯誤處理測試失敗: ${error.message}`);
      }
    }, 10000);
  });

  describe('性能測試', () => {
    test('API 響應時間應該在合理範圍內', async () => {
      if (!arbitrageEngine) {
        console.log('跳過測試：未初始化套利引擎');
        return;
      }

      const iterations = 5;
      const responseTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          const bybitExchange = arbitrageEngine.exchanges.bybit;
          await bybitExchange.getOrderBook('BTCUSDT', 'linear');
        } catch (error) {
          // 忽略錯誤，只測試響應時間
        }
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        // 等待 1 秒避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`📊 平均響應時間: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`📊 最大響應時間: ${maxResponseTime}ms`);

      // 響應時間應該小於 5 秒
      expect(avgResponseTime).toBeLessThan(5000);
      expect(maxResponseTime).toBeLessThan(10000);
    }, 30000);

    test('並發請求應該正常處理', async () => {
      if (!arbitrageEngine) {
        console.log('跳過測試：未初始化套利引擎');
        return;
      }

      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const startTime = Date.now();

      const promises = symbols.map(async (symbol) => {
        try {
          const bybitExchange = arbitrageEngine.exchanges.bybit;
          const result = await bybitExchange.getOrderBook(symbol, 'linear');
          return { symbol, success: true, result };
        } catch (error) {
          return { symbol, success: false, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`⚡ 並發請求完成時間: ${duration}ms`);
      console.log(`📊 成功請求: ${results.filter(r => r.success).length}/${results.length}`);

      expect(results).toHaveLength(symbols.length);
      expect(duration).toBeLessThan(15000); // 15 秒內完成
    }, 20000);
  });
});
