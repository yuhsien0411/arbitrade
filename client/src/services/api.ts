/**
 * API服務
 * 處理與後端API的通訊
 */

import axios from 'axios';
import logger from '../utils/logger';

// 創建axios實例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:7000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器
api.interceptors.request.use(
  (config) => {
    logger.info('API Request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      data: config.data,
      params: config.params,
      headers: config.headers,
      timestamp: new Date().toISOString()
    }, 'API');
    return config;
  },
  (error) => {
    logger.error('API Request Error', error, 'API');
    return Promise.reject(error);
  }
);

// 響應攔截器
api.interceptors.response.use(
  (response) => {
    logger.info('API Response', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      responseTime: response.headers['x-response-time'] || 'N/A',
      timestamp: new Date().toISOString()
    }, 'API');
    return response.data;
  },
  (error) => {
    logger.error('API Response Error', {
      method: error.config?.method?.toUpperCase() || 'UNKNOWN',
      url: error.config?.url || 'UNKNOWN',
      status: error.response?.status || 'NO_RESPONSE',
      statusText: error.response?.statusText || 'NETWORK_ERROR',
      message: error.message,
      responseData: error.response?.data,
      timestamp: new Date().toISOString()
    }, 'API');
    
    // 統一錯誤處理
    const errorMessage = error.response?.data?.error || error.message || '網路錯誤';
    return Promise.reject(new Error(errorMessage));
  }
);

// API接口定義
export const apiService = {
  // 系統狀態
  getStatus: () => api.get('/status'),
  
  // 交易所信息
  getExchanges: () => api.get('/api/exchanges'),
  
  // 新增：交易所狀態（與 /api/exchanges 等價，便於對齊 pmC.md）
  getExchangeStatus: async (): Promise<ApiResponse<Record<string, ExchangeInfo>>> => {
    try {
      const res = await api.get('/api/exchanges');
      return res as unknown as ApiResponse<Record<string, ExchangeInfo>>;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // 新增：獲取指定交易所的 symbols（若後端未返回則使用 mock）
  getSymbols: async (exchange: string): Promise<ApiResponse<string[]>> => {
    try {
      const useMock = (process.env.REACT_APP_USE_MOCK || '').toLowerCase() === 'true';
      if (useMock) {
        const mock = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT'];
        return { success: true, data: mock };
      }

      const res = await api.get('/api/exchanges');
      const data = (res as unknown as ApiResponse<Record<string, ExchangeInfo>>).data;
      if (!data || !data[exchange]) {
        return { success: true, data: [] };
      }
      const symbolsInfo = data[exchange].symbols;
      const symbols: string[] = [];
      if (symbolsInfo?.spot) symbols.push(...symbolsInfo.spot);
      if ((symbolsInfo as any)?.future) symbols.push(...(symbolsInfo as any).future);
      if (symbolsInfo?.linear) symbols.push(...symbolsInfo.linear);
      if (symbolsInfo?.inverse) symbols.push(...symbolsInfo.inverse);
      return { success: true, data: Array.from(new Set(symbols)) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  
  // 新增：watch pair（對齊 pmC.md，轉發到現有監控接口）
  addWatchPair: (payload: any) => api.post('/api/monitoring/pairs', payload),

  // 新增：交易所狀態管理
  getExchangeStats: () => api.get('/api/exchanges/stats'),
  getImplementedExchanges: () => api.get('/api/exchanges/implemented'),
  getPlannedExchanges: () => api.get('/api/exchanges/planned'),
  getConnectedExchanges: () => api.get('/api/exchanges/connected'),
  getRecommendedPairs: () => api.get('/api/exchanges/recommended-pairs'),
  getExchangeFeatures: () => api.get('/api/exchanges/features'),
  checkFeatureSupport: (exchange: string, feature: string) => 
    api.get(`/api/exchanges/${exchange}/features/${feature}`),
  
  // 價格數據
  getPrice: (exchange: string, symbol: string) => 
    api.get(`/api/prices/${exchange}/${symbol}`),
  
  getBatchPrices: (symbols: string[]) => 
    api.post('/api/prices/batch', { symbols }),
  
  // 監控交易對管理
  getMonitoringPairs: () => api.get('/api/monitoring/pairs'),
  
  addMonitoringPair: (config: any) => 
    api.post('/api/monitoring/pairs', config),
  
  updateMonitoringPair: (id: string, updates: any) => 
    api.put(`/api/monitoring/pairs/${id}`, updates),
  
  removeMonitoringPair: (id: string) => 
    api.delete(`/api/monitoring/pairs/${id}`),

  // 獲取監控交易對的實時價格（若後端未提供，請改用 websocket 或 batch）
  getMonitoringPrices: () => api.get('/api/monitoring/prices'),
  
  // 套利執行
  executeArbitrage: (pairId: string) => 
    api.post(`/api/arbitrage/execute/${pairId}`),
  
  // TWAP策略管理
  getTwapStrategies: () => api.get('/api/twap/plans'),
  
  addTwapStrategy: (config: any) => 
    api.post('/api/twap/plans', config),
  
  updateTwapStrategy: (id: string, updates: any) => 
    api.put(`/api/twap/plans/${id}`, updates),
  
  removeTwapStrategy: (id: string) => 
    api.delete(`/api/twap/plans/${id}`),
  
  controlTwapStrategy: (id: string, action: string) =>
    api.post(`/api/twap/${id}/control`, { action }),
  
  // 賬戶信息
  getAccount: (exchange: string) => 
    api.get(`/api/account/${exchange}`),
  
  // 設置
  updateRiskSettings: (settings: any) => 
    api.put('/api/settings/risk', settings),

  // API設定
  getApiSettings: () =>
    api.get('/api/settings/api'),

  getApiSettingsForEdit: () =>
    api.get('/api/settings/api/edit'),

  updateApiSettings: (settings: any) =>
    api.put('/api/settings/api', settings),

  deleteApiSettings: (exchange: string) =>
    api.delete(`/api/settings/api/${exchange}`),

  testApiConnection: (exchange?: string) =>
    api.post('/api/settings/api/test', exchange ? { exchange } : {}),
  
  // 統計數據
  getStats: () => api.get('/stats'),
};

// 類型定義
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ExchangeInfo {
  name: string;
  connected: boolean;
  status?: 'active' | 'ready' | 'planned' | 'unknown';
  implemented?: boolean;
  message?: string;
  features?: string[];
  priority?: number;
  symbols?: {
    spot: string[];
    linear: string[];    // 重命名：future -> linear
    inverse: string[];   // 新增
  };
  comingSoon?: boolean;
}

export interface MonitoringPairConfig {
  id?: string;
  leg1: {
    exchange: string;
    symbol: string;
    type: 'future' | 'spot' | 'linear' | 'inverse';
    side?: 'buy' | 'sell';
  };
  leg2: {
    exchange: string;
    symbol: string;
    type: 'future' | 'spot' | 'linear' | 'inverse';
    side?: 'buy' | 'sell';
  };
  threshold: number;
  amount: number;
  enabled?: boolean;
  executionMode?: 'market' | 'threshold';
  // 新增參數
  qty?: number;
  totalAmount?: number;
  consumedAmount?: number;
}

export interface TwapStrategyConfig {
  id?: string;
  leg1: {
    exchange: string;
    symbol: string;
    type: 'future' | 'spot';
    side: 'buy' | 'sell';
  };
  leg2: {
    exchange: string;
    symbol: string;
    type: 'future' | 'spot';
    side: 'buy' | 'sell';
  };
  totalAmount: number;
  timeInterval: number;
  orderCount: number;
  priceType?: 'market' | 'limit';
  enabled?: boolean;
}

export interface RiskSettings {
  maxPositionSize?: number;
  maxDailyLoss?: number;
  priceDeviationThreshold?: number;
}

export interface ApiSettings {
  bybitApiKey?: string;
  bybitSecret?: string;
  bybitTestnet?: boolean;
}

export interface AccountInfo {
  balance: any;
  positions: any[];
}

export interface SystemStats {
  totalTrades: number;
  successfulTrades: number;
  totalProfit: number;
  todayProfit: number;
}

// 導出默認實例
export default api;
