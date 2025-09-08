/**
 * API服務
 * 處理與後端API的通訊
 */

import axios from 'axios';

// 創建axios實例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器
api.interceptors.request.use(
  (config) => {
    console.log(`API請求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API請求錯誤:', error);
    return Promise.reject(error);
  }
);

// 響應攔截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API響應錯誤:', error);
    
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

  // 獲取監控交易對的實時價格
  getMonitoringPrices: () => api.get('/api/monitoring/prices'),
  
  // 套利執行
  executeArbitrage: (pairId: string) => 
    api.post(`/api/arbitrage/execute/${pairId}`),
  
  // TWAP策略管理
  getTwapStrategies: () => api.get('/api/twap/strategies'),
  
  addTwapStrategy: (config: any) => 
    api.post('/api/twap/strategies', config),
  
  updateTwapStrategy: (id: string, updates: any) => 
    api.put(`/api/twap/strategies/${id}`, updates),
  
  removeTwapStrategy: (id: string) => 
    api.delete(`/api/twap/strategies/${id}`),
  
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

  updateApiSettings: (settings: ApiSettings) =>
    api.put('/api/settings/api', settings),

  deleteApiSettings: (exchange: string) =>
    api.delete(`/api/settings/api/${exchange}`),

  testApiConnection: () =>
    api.get('/api/settings/api/test'),
  
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
  symbols?: {
    future: string[];
    spot: string[];
  };
  comingSoon?: boolean;
}

export interface MonitoringPairConfig {
  id?: string;
  leg1: {
    exchange: string;
    symbol: string;
    type: 'future' | 'spot';
    side?: 'buy' | 'sell';
  };
  leg2: {
    exchange: string;
    symbol: string;
    type: 'future' | 'spot';
    side?: 'buy' | 'sell';
  };
  threshold: number;
  amount: number;
  enabled?: boolean;
  executionMode?: 'market' | 'threshold';
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
