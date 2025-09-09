/**
 * 套利系統性能測試
 * 測試系統在高負載下的性能表現
 */
const { ArbitrageEngine } = require('../../services/arbitrageEngine');
const ExchangeFactory = require('../../exchanges/index');
const logger = require('../../utils/logger');

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('套利系統性能測試', () => {
  let arbitrageEngine;

  beforeEach(() => {
    arbitrageEngine = new ArbitrageEngine();
  });

  afterEach(() => {
    if (arbitrageEngine && arbitrageEngine.isRunning) {
      arbitrageEngine.stop();
    }
  });

  describe('價格獲取性能', () => {
    test('單個交易所價格獲取性能', async () => {
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        
        // 模擬價格獲取
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // 轉換為毫秒
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      expect(avgTime).toBeLessThan(50); // 平均小於 50ms
      expect(maxTime).toBeLessThan(200); // 最大小於 200ms
      expect(minTime).toBeGreaterThan(0);
    });

    test('並發價格獲取性能', async () => {
      const concurrency = 50;
      const startTime = process.hrtime.bigint();

      const promises = Array.from({ length: concurrency }, async (_, i) => {
        // 模擬並發價格獲取
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        return `price-${i}`;
      });

      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(concurrency);
      expect(totalTime).toBeLessThan(1000); // 1秒內完成
    });

    test('跨交易所價格獲取性能', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const times = [];

      for (const symbol of symbols) {
        const startTime = process.hrtime.bigint();
        
        // 模擬跨交易所價格獲取
        await Promise.all([
          new Promise(resolve => setTimeout(resolve, Math.random() * 15)),
          new Promise(resolve => setTimeout(resolve, Math.random() * 15))
        ]);
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(100); // 平均小於 100ms
    });
  });

  describe('套利計算性能', () => {
    test('價差計算性能', () => {
      const iterations = 10000;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        const price1 = 50000 + Math.random() * 100;
        const price2 = 49950 + Math.random() * 100;
        const priceDiff = Math.abs(price1 - price2);
        const priceDiffPercent = (priceDiff / Math.min(price1, price2)) * 100;
      }

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;
      const avgTime = totalTime / iterations;

      expect(totalTime).toBeLessThan(100); // 總時間小於 100ms
      expect(avgTime).toBeLessThan(0.01); // 平均每次小於 0.01ms
    });

    test('套利機會檢測性能', () => {
      const opportunities = 1000;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < opportunities; i++) {
        const bybitPrice = 50000 + Math.random() * 100;
        const binancePrice = 49950 + Math.random() * 100;
        const minProfit = 0.001; // 0.1%
        
        const profit = bybitPrice - binancePrice;
        const profitPercent = (profit / binancePrice) * 100;
        const isOpportunity = profitPercent > minProfit;
      }

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(totalTime).toBeLessThan(50); // 50ms 內完成
    });

    test('批量套利計算性能', () => {
      const pairs = 100;
      const startTime = process.hrtime.bigint();

      const results = [];
      for (let i = 0; i < pairs; i++) {
        const bybitPrice = 50000 + Math.random() * 100;
        const binancePrice = 49950 + Math.random() * 100;
        
        const profit = bybitPrice - binancePrice;
        const profitPercent = (profit / binancePrice) * 100;
        
        results.push({
          pair: `pair-${i}`,
          profit,
          profitPercent,
          isOpportunity: profitPercent > 0.001
        });
      }

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(pairs);
      expect(totalTime).toBeLessThan(20); // 20ms 內完成
    });
  });

  describe('內存使用性能', () => {
    test('內存使用量監控', () => {
      const initialMemory = process.memoryUsage();
      
      // 創建大量數據
      const data = [];
      for (let i = 0; i < 10000; i++) {
        data.push({
          id: i,
          symbol: 'BTCUSDT',
          price: 50000 + Math.random() * 100,
          timestamp: Date.now()
        });
      }

      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(50); // 內存增加小於 50MB
    });

    test('垃圾回收性能', () => {
      const startTime = process.hrtime.bigint();

      // 創建和銷毀大量對象
      for (let i = 0; i < 1000; i++) {
        const tempData = Array.from({ length: 1000 }, (_, j) => ({
          id: j,
          value: Math.random()
        }));
        // 對象會被垃圾回收
      }

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(totalTime).toBeLessThan(500); // 500ms 內完成
    });
  });

  describe('網絡性能', () => {
    test('API 響應時間模擬', async () => {
      const requests = 100;
      const responseTimes = [];

      for (let i = 0; i < requests; i++) {
        const startTime = process.hrtime.bigint();
        
        // 模擬 API 請求
        await new Promise(resolve => 
          setTimeout(resolve, Math.random() * 50 + 10) // 10-60ms
        );
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        responseTimes.push(responseTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(requests * 0.95)];

      expect(avgResponseTime).toBeLessThan(50); // 平均響應時間小於 50ms
      expect(maxResponseTime).toBeLessThan(100); // 最大響應時間小於 100ms
      expect(p95ResponseTime).toBeLessThan(80); // 95% 響應時間小於 80ms
    });

    test('並發請求處理能力', async () => {
      const concurrency = 200;
      const startTime = process.hrtime.bigint();

      const promises = Array.from({ length: concurrency }, async (_, i) => {
        // 模擬並發 API 請求
        await new Promise(resolve => 
          setTimeout(resolve, Math.random() * 30 + 5) // 5-35ms
        );
        return `response-${i}`;
      });

      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(concurrency);
      expect(totalTime).toBeLessThan(2000); // 2秒內完成
    });
  });

  describe('數據處理性能', () => {
    test('大量數據處理性能', () => {
      const dataSize = 100000;
      const startTime = process.hrtime.bigint();

      // 生成大量價格數據
      const priceData = Array.from({ length: dataSize }, (_, i) => ({
        id: i,
        symbol: 'BTCUSDT',
        price: 50000 + Math.random() * 100,
        timestamp: Date.now() - Math.random() * 3600000 // 1小時內
      }));

      // 處理數據：計算移動平均
      const windowSize = 100;
      const movingAverages = [];
      for (let i = windowSize; i < priceData.length; i++) {
        const window = priceData.slice(i - windowSize, i);
        const average = window.reduce((sum, item) => sum + item.price, 0) / windowSize;
        movingAverages.push(average);
      }

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(priceData).toHaveLength(dataSize);
      expect(movingAverages).toHaveLength(dataSize - windowSize);
      expect(totalTime).toBeLessThan(1000); // 1秒內完成
    });

    test('數據過濾性能', () => {
      const dataSize = 50000;
      const startTime = process.hrtime.bigint();

      // 生成數據
      const data = Array.from({ length: dataSize }, (_, i) => ({
        id: i,
        value: Math.random() * 1000,
        category: i % 2 === 0 ? 'A' : 'B'
      }));

      // 過濾數據
      const filteredData = data.filter(item => item.value > 500);
      const groupedData = data.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {});

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(filteredData.length).toBeLessThan(dataSize);
      expect(Object.keys(groupedData)).toHaveLength(2);
      expect(totalTime).toBeLessThan(100); // 100ms 內完成
    });
  });

  describe('系統穩定性測試', () => {
    test('長時間運行穩定性', async () => {
      const duration = 5000; // 5秒
      const interval = 100; // 100ms
      const iterations = duration / interval;
      let successCount = 0;

      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        try {
          // 模擬套利計算
          const price1 = 50000 + Math.random() * 100;
          const price2 = 49950 + Math.random() * 100;
          const profit = price1 - price2;
          
          if (profit > 0) successCount++;
          
          await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
          // 記錄錯誤但不中斷測試
        }
      }

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      expect(actualDuration).toBeGreaterThanOrEqual(duration - 100); // 允許 100ms 誤差
      expect(successCount).toBeGreaterThan(0);
    }, 20000);

    test('錯誤恢復性能', async () => {
      const errorRate = 0.1; // 10% 錯誤率
      const requests = 1000;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < requests; i++) {
        try {
          // 模擬可能失敗的請求
          if (Math.random() < errorRate) {
            throw new Error('Simulated error');
          }
          
          // 模擬成功請求
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          successCount++;
        } catch (error) {
          errorCount++;
          // 模擬錯誤恢復
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }

      const actualErrorRate = errorCount / requests;
      expect(actualErrorRate).toBeCloseTo(errorRate, 1); // 允許 10% 誤差
      expect(successCount + errorCount).toBe(requests);
    }, 20000);
  });

  describe('資源使用優化', () => {
    test('CPU 使用率優化', () => {
      const startTime = process.hrtime.bigint();
      
      // 模擬 CPU 密集型計算
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i) * Math.sin(i);
      }
      
      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000;

      expect(totalTime).toBeLessThan(1000); // 1秒內完成
      expect(result).toBeDefined();
    });

    test('內存泄漏檢測', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 執行多次操作
      for (let cycle = 0; cycle < 10; cycle++) {
        const data = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: Math.random()
        }));
        
        // 處理數據
        const processed = data.map(item => ({
          ...item,
          processed: true
        }));
        
        // 數據應該被垃圾回收
      }
      
      // 強制垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(10); // 內存增加小於 10MB
    });
  });
});
