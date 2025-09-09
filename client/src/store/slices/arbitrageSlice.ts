/**
 * 套利交易狀態管理
 */

import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { apiService } from '../../services/api';

interface ArbitragePair {
  id: string;
  leg1: {
    exchange: string;
    symbol: string;
    type: 'linear' | 'inverse' | 'spot' | 'future';
    side?: 'buy' | 'sell';
  };
  leg2: {
    exchange: string;
    symbol: string;
    type: 'linear' | 'inverse' | 'spot' | 'future';
    side?: 'buy' | 'sell';
  };
  threshold: number;
  amount: number;
  enabled: boolean;
  createdAt: number;
  lastTriggered: number | null;
  totalTriggers: number;
  // 新增參數
  qty?: number;
  totalAmount?: number;
  consumedAmount?: number;
}

interface ArbitrageOpportunity {
  id: string;
  pairConfig: ArbitragePair;
  leg1Price: {
    symbol: string;
    exchange: string;
    bid1: { price: number; amount: number } | null;
    ask1: { price: number; amount: number } | null;
  };
  leg2Price: {
    symbol: string;
    exchange: string;
    bid1: { price: number; amount: number } | null;
    ask1: { price: number; amount: number } | null;
  };
  spread: number;
  spreadPercent: number;
  threshold: number;
  shouldTrigger: boolean;
  timestamp: number;
  direction: 'leg1_sell_leg2_buy' | 'leg1_buy_leg2_sell';
}

interface ArbitrageExecution {
  opportunity: ArbitrageOpportunity;
  result?: any;
  error?: string;
  success: boolean;
  timestamp: number;
}

interface ArbitrageState {
  monitoringPairs: ArbitragePair[];
  currentOpportunities: ArbitrageOpportunity[];
  recentExecutions: ArbitrageExecution[];
  isAutoExecuteEnabled: boolean;
  executionHistory: ArbitrageExecution[];
}

const initialState: ArbitrageState = {
  monitoringPairs: [],
  currentOpportunities: [],
  recentExecutions: [],
  isAutoExecuteEnabled: false,
  executionHistory: [],
};

export const addWatchPairThunk = createAsyncThunk(
  'arbitrage/addWatchPair',
  async (payload: any, { rejectWithValue }) => {
    try {
      const res = await apiService.addWatchPair(payload);
      if ((res as any)?.success === false) {
        return rejectWithValue((res as any)?.error || '添加失敗');
      }
      return (res as any).data || res;
    } catch (e: any) {
      return rejectWithValue(e.message || '添加失敗');
    }
  }
);

const arbitrageSlice = createSlice({
  name: 'arbitrage',
  initialState,
  reducers: {
    addMonitoringPair: (state, action: PayloadAction<ArbitragePair>) => {
      const existingIndex = state.monitoringPairs.findIndex(p => p.id === action.payload.id);
      if (existingIndex >= 0) {
        state.monitoringPairs[existingIndex] = action.payload;
      } else {
        state.monitoringPairs.push(action.payload);
      }
    },
    
    updateMonitoringPair: (state, action: PayloadAction<{ id: string; updates: Partial<ArbitragePair> }>) => {
      const { id, updates } = action.payload;
      const index = state.monitoringPairs.findIndex(p => p.id === id);
      if (index >= 0) {
        state.monitoringPairs[index] = { ...state.monitoringPairs[index], ...updates };
      }
    },
    
    removeMonitoringPair: (state, action: PayloadAction<string>) => {
      state.monitoringPairs = state.monitoringPairs.filter(p => p.id !== action.payload);
      // 同時移除相關的機會數據
      state.currentOpportunities = state.currentOpportunities.filter(o => o.id !== action.payload);
    },
    
    setMonitoringPairs: (state, action: PayloadAction<ArbitragePair[]>) => {
      state.monitoringPairs = action.payload;
    },
    
    updateOpportunity: (state, action: PayloadAction<ArbitrageOpportunity>) => {
      const existingIndex = state.currentOpportunities.findIndex(o => o.id === action.payload.id);
      if (existingIndex >= 0) {
        state.currentOpportunities[existingIndex] = action.payload;
      } else {
        state.currentOpportunities.push(action.payload);
      }
    },
    
    setOpportunities: (state, action: PayloadAction<ArbitrageOpportunity[]>) => {
      state.currentOpportunities = action.payload;
    },
    
    addExecution: (state, action: PayloadAction<ArbitrageExecution>) => {
      // 添加到最近執行列表
      state.recentExecutions.unshift(action.payload);
      if (state.recentExecutions.length > 20) {
        state.recentExecutions = state.recentExecutions.slice(0, 20);
      }
      
      // 添加到歷史記錄
      state.executionHistory.unshift(action.payload);
      if (state.executionHistory.length > 1000) {
        state.executionHistory = state.executionHistory.slice(0, 1000);
      }
      
      // 更新對應交易對的觸發統計
      const pairId = action.payload.opportunity.id;
      const pairIndex = state.monitoringPairs.findIndex(p => p.id === pairId);
      if (pairIndex >= 0) {
        state.monitoringPairs[pairIndex].lastTriggered = action.payload.timestamp;
        if (action.payload.success) {
          state.monitoringPairs[pairIndex].totalTriggers += 1;
        }
      }
    },
    
    setAutoExecute: (state, action: PayloadAction<boolean>) => {
      state.isAutoExecuteEnabled = action.payload;
    },
    
    clearExecutionHistory: (state) => {
      state.executionHistory = [];
      state.recentExecutions = [];
    },
    
    // 批量更新價格數據
    updatePricesForOpportunities: (state, action: PayloadAction<Array<{ id: string; leg1Price?: any; leg2Price?: any; spread: number; spreadPercent: number }>>) => {
      action.payload.forEach(update => {
        const index = state.currentOpportunities.findIndex(o => o.id === update.id);
        if (index >= 0) {
          if (update.leg1Price) {
            state.currentOpportunities[index].leg1Price = update.leg1Price;
          }
          if (update.leg2Price) {
            state.currentOpportunities[index].leg2Price = update.leg2Price;
          }
          state.currentOpportunities[index].spread = update.spread;
          state.currentOpportunities[index].spreadPercent = update.spreadPercent;
          state.currentOpportunities[index].timestamp = Date.now();
        }
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addWatchPairThunk.fulfilled, (state, action: PayloadAction<any>) => {
        if (action.payload) {
          const pair = action.payload;
          const existingIndex = state.monitoringPairs.findIndex(p => p.id === pair.id);
          if (existingIndex >= 0) {
            state.monitoringPairs[existingIndex] = pair;
          } else {
            state.monitoringPairs.push(pair);
          }
        }
      });
  }
});

export const {
  addMonitoringPair,
  updateMonitoringPair,
  removeMonitoringPair,
  setMonitoringPairs,
  updateOpportunity,
  setOpportunities,
  addExecution,
  setAutoExecute,
  clearExecutionHistory,
  updatePricesForOpportunities,
} = arbitrageSlice.actions;

export default arbitrageSlice.reducer;
