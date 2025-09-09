/**
 * 系統集成測試
 * 測試整個系統的集成功能
 */
const request = require('supertest');
const mongoose = require('mongoose');
const { initializeDB, cleanupDB, ArbitragePair, Trade, PriceData } = require('../../models');
const DataPersistenceService = require('../../services/DataPersistenceService');

// Mock 套利引擎
jest.mock('../../services/arbitrageEngine', () => ({
  getArbitrageEngine: () => ({
    isRunning: true,
    exchanges: {
      bybit: {
        isExchangeConnected: () => true,
        getAvailableSymbols: (type) => ['BTCUSDT', 'ETHUSDT']
      }
    },
    getStatus: () => ({
      isRunning: true,
      totalTrades: 0,
      totalProfit: 0
    })
  })
}));

describe('系統集成測試', () => {
  let app;
  let server;

  beforeAll(async () => {
    // 初始化數據庫
    await initializeDB();
    
    // 創建 Express 應用
    const express = require('express');
    app = express();
    app.use(express.json());
    
    // 添加路由
    const apiRoutes = require('../../routes/api');
    app.use('/api', apiRoutes);
    
    // 啟動服務器
    server = app.listen(0);
  });

  afterAll(async () => {
    // 清理數據庫
    await cleanupDB();
    
    // 關閉服務器
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // 清理測試數據
    await Promise.all([
      ArbitragePair.deleteMany({}),
      Trade.deleteMany({}),
      PriceData.deleteMany({})
    ]);
  });

  describe('API 端點測試', () => {
    test('GET /api/status - 獲取系統狀態', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isRunning');
    });

    test('GET /api/exchanges - 獲取交易所信息', async () => {
      const response = await request(app)
        .get('/api/exchanges')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('bybit');
      expect(response.body.data.bybit.connected).toBe(true);
    });

    test('GET /api/arbitrage-pairs - 獲取套利交易對', async () => {
      const response = await request(app)
        .get('/api/arbitrage-pairs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/arbitrage-pairs - 創建套利交易對', async () => {
      const pairData = {
        id: 'test_pair_integration',
        leg1: {
          exchange: 'bybit',
          symbol: 'BTCUSDT',
          type: 'linear',
          side: 'buy'
        },
        leg2: {
          exchange: 'bybit',
          symbol: 'BTCUSDT',
          type: 'linear',
          side: 'sell'
        },
        threshold: 0.1,
        amount: 50,
        executionMode: 'threshold'
      };

      const response = await request(app)
        .post('/api/arbitrage-pairs')
        .send(pairData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test_pair_integration');
    });

    test('PUT /api/arbitrage-pairs/:id - 更新套利交易對', async () => {
      // 先創建一個交易對
      const pair = new ArbitragePair({
        id: 'test_update_pair',
        leg1: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'buy' },
        leg2: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'sell' },
        threshold: 0.1,
        amount: 50
      });
      await pair.save();

      const updateData = { threshold: 0.2, amount: 100 };

      const response = await request(app)
        .put('/api/arbitrage-pairs/test_update_pair')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.threshold).toBe(0.2);
      expect(response.body.data.amount).toBe(100);
    });

    test('DELETE /api/arbitrage-pairs/:id - 刪除套利交易對', async () => {
      // 先創建一個交易對
      const pair = new ArbitragePair({
        id: 'test_delete_pair',
        leg1: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'buy' },
        leg2: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'sell' },
        threshold: 0.1,
        amount: 50
      });
      await pair.save();

      const response = await request(app)
        .delete('/api/arbitrage-pairs/test_delete_pair')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('套利交易對已刪除');
    });

    test('GET /api/trades - 獲取交易記錄', async () => {
      const response = await request(app)
        .get('/api/trades')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('trades');
      expect(response.body.data).toHaveProperty('total');
    });

    test('GET /api/price-data - 獲取價格數據', async () => {
      const response = await request(app)
        .get('/api/price-data?exchange=bybit&symbol=BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('數據持久化服務測試', () => {
    test('初始化數據持久化服務', async () => {
      await expect(DataPersistenceService.initialize()).resolves.not.toThrow();
    });

    test('創建和獲取套利交易對', async () => {
      const pairData = {
        id: 'test_persistence_pair',
        leg1: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'buy' },
        leg2: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'sell' },
        threshold: 0.1,
        amount: 50
      };

      const createdPair = await DataPersistenceService.createArbitragePair(pairData);
      expect(createdPair.id).toBe('test_persistence_pair');

      const pairs = await DataPersistenceService.getArbitragePairs();
      expect(pairs.length).toBe(1);
      expect(pairs[0].id).toBe('test_persistence_pair');
    });

    test('創建和更新交易記錄', async () => {
      const tradeData = {
        tradeId: 'test_trade_001',
        arbitragePairId: 'test_pair',
        tradeType: 'arbitrage',
        leg1: {
          exchange: 'bybit',
          symbol: 'BTCUSDT',
          side: 'buy',
          orderId: 'order_001',
          price: 50000,
          quantity: 0.1
        },
        leg2: {
          exchange: 'bybit',
          symbol: 'BTCUSDT',
          side: 'sell',
          orderId: 'order_002',
          price: 50010,
          quantity: 0.1
        },
        priceDifference: 10,
        expectedProfit: 1
      };

      const createdTrade = await DataPersistenceService.createTrade(tradeData);
      expect(createdTrade.tradeId).toBe('test_trade_001');

      const updatedTrade = await DataPersistenceService.updateTradeLegStatus(
        'test_trade_001', 1, 'filled', new Date()
      );
      expect(updatedTrade.leg1.status).toBe('filled');
    });

    test('保存和獲取價格數據', async () => {
      const priceData = {
        exchange: 'bybit',
        symbol: 'BTCUSDT',
        bid: { price: 50000, size: 1.0 },
        ask: { price: 50001, size: 1.0 },
        timestamp: new Date()
      };

      const savedData = await DataPersistenceService.savePriceData(priceData);
      expect(savedData.exchange).toBe('bybit');
      expect(savedData.symbol).toBe('BTCUSDT');

      const latestData = await DataPersistenceService.getLatestPriceData('bybit', 'BTCUSDT');
      expect(latestData.exchange).toBe('bybit');
      expect(latestData.symbol).toBe('BTCUSDT');
    });

    test('獲取系統統計', async () => {
      const stats = await DataPersistenceService.getSystemStats();
      expect(stats).toHaveProperty('totalPairs');
      expect(stats).toHaveProperty('activePairs');
      expect(stats).toHaveProperty('totalTrades');
    });
  });

  describe('數據庫模型測試', () => {
    test('ArbitragePair 模型驗證', async () => {
      const invalidPair = new ArbitragePair({
        id: 'test_invalid'
        // 缺少必需字段
      });

      await expect(invalidPair.save()).rejects.toThrow();
    });

    test('Trade 模型計算利潤', async () => {
      const trade = new Trade({
        tradeId: 'test_profit_calc',
        arbitragePairId: 'test_pair',
        tradeType: 'arbitrage',
        leg1: {
          exchange: 'bybit',
          symbol: 'BTCUSDT',
          side: 'buy',
          orderId: 'order_001',
          price: 50000,
          quantity: 0.1,
          status: 'filled'
        },
        leg2: {
          exchange: 'bybit',
          symbol: 'BTCUSDT',
          side: 'sell',
          orderId: 'order_002',
          price: 50010,
          quantity: 0.1,
          status: 'filled'
        },
        priceDifference: 10,
        expectedProfit: 1
      });

      await trade.save();
      expect(trade.isCompleted).toBe(true);
      expect(trade.actualProfit).toBe(1); // 50010 * 0.1 - 50000 * 0.1 = 1
    });

    test('PriceData 模型計算價差', async () => {
      const priceData = new PriceData({
        exchange: 'bybit',
        symbol: 'BTCUSDT',
        bid: { price: 50000, size: 1.0 },
        ask: { price: 50001, size: 1.0 },
        timestamp: new Date()
      });

      await priceData.save();
      expect(priceData.midPrice).toBe(50000.5);
      expect(priceData.spread).toBe(1);
      expect(priceData.spreadPercentage).toBeCloseTo(0.002, 3);
    });
  });

  describe('錯誤處理測試', () => {
    test('創建重複的套利交易對', async () => {
      const pairData = {
        id: 'duplicate_test',
        leg1: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'buy' },
        leg2: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear', side: 'sell' },
        threshold: 0.1,
        amount: 50
      };

      // 第一次創建應該成功
      await DataPersistenceService.createArbitragePair(pairData);

      // 第二次創建應該失敗
      await expect(DataPersistenceService.createArbitragePair(pairData))
        .rejects.toThrow();
    });

    test('更新不存在的套利交易對', async () => {
      await expect(DataPersistenceService.updateArbitragePair('nonexistent', {}))
        .rejects.toThrow('套利交易對不存在');
    });

    test('獲取不存在的交易記錄', async () => {
      const trades = await DataPersistenceService.getTrades({ tradeId: 'nonexistent' });
      expect(trades.trades.length).toBe(0);
      expect(trades.total).toBe(0);
    });
  });
});
