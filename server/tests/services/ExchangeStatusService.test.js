/**
 * ExchangeStatusService 單元測試
 */
const ExchangeStatusService = require('../../services/ExchangeStatusService');

// Mock ExchangeFactory
jest.mock('../../exchanges/index', () => ({
  getExchange: jest.fn()
}));

describe('ExchangeStatusService', () => {
  beforeEach(() => {
    // 重置 mock
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    test('應該正確初始化所有交易所狀態', () => {
      const statuses = ExchangeStatusService.getAllExchangeStatuses();
      
      expect(statuses.bybit).toBeDefined();
      expect(statuses.bybit.name).toBe('Bybit');
      expect(statuses.bybit.status).toBe('active');
      expect(statuses.bybit.implemented).toBe(true);
      
      expect(statuses.binance).toBeDefined();
      expect(statuses.binance.name).toBe('Binance');
      expect(statuses.binance.status).toBe('ready');
      expect(statuses.binance.implemented).toBe(true);
      
      expect(statuses.okx).toBeDefined();
      expect(statuses.okx.name).toBe('OKX');
      expect(statuses.okx.status).toBe('planned');
      expect(statuses.okx.implemented).toBe(false);
      
      expect(statuses.bitget).toBeDefined();
      expect(statuses.bitget.name).toBe('Bitget');
      expect(statuses.bitget.status).toBe('planned');
      expect(statuses.bitget.implemented).toBe(false);
    });
  });

  describe('獲取交易所狀態', () => {
    test('應該返回特定交易所的狀態', () => {
      const bybitStatus = ExchangeStatusService.getExchangeStatus('bybit');
      
      expect(bybitStatus.name).toBe('Bybit');
      expect(bybitStatus.status).toBe('active');
      expect(bybitStatus.implemented).toBe(true);
      expect(bybitStatus.features).toContain('spot');
      expect(bybitStatus.features).toContain('linear');
      expect(bybitStatus.features).toContain('inverse');
    });

    test('應該處理未知交易所', () => {
      const unknownStatus = ExchangeStatusService.getExchangeStatus('unknown');
      
      expect(unknownStatus.name).toBe('unknown');
      expect(unknownStatus.status).toBe('unknown');
      expect(unknownStatus.implemented).toBe(false);
      expect(unknownStatus.message).toContain('未知的交易所');
    });

    test('應該不區分大小寫', () => {
      const bybitStatus1 = ExchangeStatusService.getExchangeStatus('bybit');
      const bybitStatus2 = ExchangeStatusService.getExchangeStatus('BYBIT');
      const bybitStatus3 = ExchangeStatusService.getExchangeStatus('Bybit');
      
      expect(bybitStatus1.name).toBe(bybitStatus2.name);
      expect(bybitStatus2.name).toBe(bybitStatus3.name);
    });
  });

  describe('獲取已實現的交易所', () => {
    test('應該返回已實現的交易所列表', () => {
      const implemented = ExchangeStatusService.getImplementedExchanges();
      
      expect(implemented.length).toBe(2);
      expect(implemented[0].name).toBe('bybit');
      expect(implemented[1].name).toBe('binance');
      
      // 應該按優先級排序
      expect(implemented[0].priority).toBeLessThan(implemented[1].priority);
    });

    test('應該包含連接狀態', () => {
      const implemented = ExchangeStatusService.getImplementedExchanges();
      
      implemented.forEach(exchange => {
        expect(exchange).toHaveProperty('connected');
        expect(typeof exchange.connected).toBe('boolean');
      });
    });
  });

  describe('獲取計劃中的交易所', () => {
    test('應該返回計劃中的交易所列表', () => {
      const planned = ExchangeStatusService.getPlannedExchanges();
      
      expect(planned.length).toBe(2);
      expect(planned[0].name).toBe('okx');
      expect(planned[1].name).toBe('bitget');
      
      // 應該按優先級排序
      expect(planned[0].priority).toBeLessThan(planned[1].priority);
    });

    test('應該不包含連接狀態', () => {
      const planned = ExchangeStatusService.getPlannedExchanges();
      
      planned.forEach(exchange => {
        expect(exchange).not.toHaveProperty('connected');
        expect(exchange.implemented).toBe(false);
      });
    });
  });

  describe('獲取連接的交易所', () => {
    test('應該返回連接的交易所列表', () => {
      const ExchangeFactory = require('../../exchanges/index');
      
      // Mock 已連接的交易所
      ExchangeFactory.getExchange.mockImplementation((name) => {
        if (name === 'bybit') {
          return {
            isExchangeConnected: () => true
          };
        }
        return null;
      });
      
      const connected = ExchangeStatusService.getConnectedExchanges();
      
      expect(connected.length).toBe(1);
      expect(connected[0].name).toBe('bybit');
      expect(connected[0].connected).toBe(true);
    });

    test('應該處理沒有連接的交易所', () => {
      const ExchangeFactory = require('../../exchanges/index');
      
      // Mock 未連接的交易所
      ExchangeFactory.getExchange.mockImplementation(() => null);
      
      const connected = ExchangeStatusService.getConnectedExchanges();
      
      expect(connected.length).toBe(0);
    });
  });

  describe('更新交易所狀態', () => {
    test('應該成功更新交易所狀態', () => {
      const result = ExchangeStatusService.updateExchangeStatus('bybit', {
        status: 'maintenance',
        message: '維護中'
      });
      
      expect(result).toBe(true);
      
      const status = ExchangeStatusService.getExchangeStatus('bybit');
      expect(status.status).toBe('maintenance');
      expect(status.message).toBe('維護中');
      expect(status).toHaveProperty('lastUpdated');
    });

    test('應該處理未知交易所的更新', () => {
      const result = ExchangeStatusService.updateExchangeStatus('unknown', {
        status: 'active'
      });
      
      expect(result).toBe(false);
    });
  });

  describe('獲取交易所統計', () => {
    test('應該返回正確的統計信息', () => {
      const stats = ExchangeStatusService.getExchangeStats();
      
      expect(stats.total).toBe(4);
      expect(stats.implemented).toBe(2);
      expect(stats.planned).toBe(2);
      expect(stats.byStatus.active).toBe(1);
      expect(stats.byStatus.ready).toBe(1);
      expect(stats.byStatus.planned).toBe(2);
    });
  });

  describe('獲取交易所功能', () => {
    test('應該返回已實現交易所的功能', () => {
      const features = ExchangeStatusService.getExchangeFeatures();
      
      expect(features.bybit).toBeDefined();
      expect(features.bybit.features).toContain('spot');
      expect(features.bybit.features).toContain('linear');
      expect(features.bybit.features).toContain('inverse');
      
      expect(features.binance).toBeDefined();
      expect(features.binance.features).toContain('spot');
      expect(features.binance.features).toContain('futures');
      
      expect(features.okx).toBeUndefined();
      expect(features.bitget).toBeUndefined();
    });
  });

  describe('檢查功能支持', () => {
    test('應該正確檢查功能支持', () => {
      expect(ExchangeStatusService.supportsFeature('bybit', 'spot')).toBe(true);
      expect(ExchangeStatusService.supportsFeature('bybit', 'linear')).toBe(true);
      expect(ExchangeStatusService.supportsFeature('bybit', 'options')).toBe(false);
      
      expect(ExchangeStatusService.supportsFeature('binance', 'spot')).toBe(true);
      expect(ExchangeStatusService.supportsFeature('binance', 'futures')).toBe(true);
      expect(ExchangeStatusService.supportsFeature('binance', 'linear')).toBe(false);
      
      expect(ExchangeStatusService.supportsFeature('okx', 'spot')).toBe(false);
      expect(ExchangeStatusService.supportsFeature('unknown', 'spot')).toBe(false);
    });
  });

  describe('獲取推薦的交易所組合', () => {
    test('應該返回推薦的交易所組合', () => {
      const pairs = ExchangeStatusService.getRecommendedExchangePairs();
      
      expect(pairs.length).toBe(1);
      expect(pairs[0].exchange1).toBe('bybit');
      expect(pairs[0].exchange2).toBe('binance');
      expect(pairs[0].commonFeatures).toContain('spot');
      expect(pairs[0].priority).toBe(1);
    });

    test('應該按優先級排序', () => {
      const pairs = ExchangeStatusService.getRecommendedExchangePairs();
      
      for (let i = 1; i < pairs.length; i++) {
        expect(pairs[i].priority).toBeGreaterThanOrEqual(pairs[i - 1].priority);
      }
    });
  });

  describe('連接狀態檢查', () => {
    test('應該正確檢查連接狀態', () => {
      const ExchangeFactory = require('../../exchanges/index');
      
      // Mock 連接狀態
      ExchangeFactory.getExchange.mockImplementation((name) => {
        if (name === 'bybit') {
          return {
            isExchangeConnected: () => true
          };
        }
        return null;
      });
      
      const isConnected = ExchangeStatusService.checkConnectionStatus('bybit');
      expect(isConnected).toBe(true);
      
      const isNotConnected = ExchangeStatusService.checkConnectionStatus('binance');
      expect(isNotConnected).toBe(false);
    });

    test('應該處理檢查錯誤', () => {
      const ExchangeFactory = require('../../exchanges/index');
      
      // Mock 拋出錯誤
      ExchangeFactory.getExchange.mockImplementation(() => {
        throw new Error('Connection error');
      });
      
      const isConnected = ExchangeStatusService.checkConnectionStatus('bybit');
      expect(isConnected).toBe(false);
    });
  });
});
