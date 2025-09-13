/**
 * WebSocket服務
 * 處理與後端的即時通訊
 */

import { AppDispatch } from '../store';
import { setConnectionStatus, addNotification, updateEngineStatus } from '../store/slices/systemSlice';
import { updateOpportunity, addExecution, setMonitoringPairs } from '../store/slices/arbitrageSlice';
import { addExecution as addTwapExecution, setStrategies } from '../store/slices/twapSlice';
import { updatePrice } from '../store/slices/pricesSlice';
import logger from '../utils/logger';

let wsRef: WebSocket | null = null;
let pollingTimers: Map<string, any> = new Map();

/**
 * 連接WebSocket
 */
export function connectWebSocket(dispatch: AppDispatch) {
  const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:7000';
  
  // 創建WebSocket連接（使用原生WebSocket而不是socket.io）
  const wsUrl = serverUrl.replace('http', 'ws') + '/ws';
  const ws = new WebSocket(wsUrl);
  wsRef = ws;

  dispatch(setConnectionStatus('connecting'));

  ws.onopen = () => {
    logger.info('WebSocket連接成功', null, 'WebSocket');
    dispatch(setConnectionStatus('connected'));
    dispatch(addNotification({
      type: 'success',
      message: 'WebSocket連接成功'
    }));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message, dispatch);
    } catch (error) {
      logger.error('解析WebSocket消息失敗', error, 'WebSocket');
    }
  };

  ws.onclose = () => {
    logger.info('WebSocket連接關閉', null, 'WebSocket');
    dispatch(setConnectionStatus('disconnected'));
    dispatch(addNotification({
      type: 'warning',
      message: 'WebSocket連接已關閉'
    }));
  };

  ws.onerror = (error) => {
    logger.error('WebSocket連接錯誤', error, 'WebSocket');
    dispatch(setConnectionStatus('error'));
    dispatch(addNotification({
      type: 'error',
      message: 'WebSocket連接錯誤'
    }));
  };

  // 心跳處理
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }, 30000);

  // 返回清理函數
  return () => {
    clearInterval(heartbeatInterval);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    wsRef = null;
    // 清理所有輪詢
    pollingTimers.forEach((timer) => clearInterval(timer));
    pollingTimers.clear();
  };
}

/**
 * 處理WebSocket消息
 */
function handleWebSocketMessage(message: any, dispatch: AppDispatch) {
  const { type, data, timestamp } = message;

  switch (type) {
    case 'welcome':
      logger.info('收到歡迎消息', message.message, 'WebSocket');
      break;

    case 'ping':
      // 心跳檢測，不需要特殊處理
      break;

    case 'status':
      // 系統狀態更新
      if (data) {
        dispatch(updateEngineStatus({
          isRunning: data.isRunning,
          stats: data.stats,
          riskLimits: data.riskLimits
        }));
        
        if (data.monitoringPairs) {
          dispatch(setMonitoringPairs(data.monitoringPairs));
        }
        
        if (data.twapStrategies) {
          dispatch(setStrategies(data.twapStrategies));
        }
      }
      break;

    case 'priceUpdate':
      // 價格更新
      if (data) {
        dispatch(updateOpportunity(data));
        
        // 同時更新價格數據
        if (data.leg1Price) {
          dispatch(updatePrice({
            symbol: data.leg1Price.symbol,
            exchange: data.leg1Price.exchange,
            timestamp: data.timestamp,
            bid1: data.leg1Price.bid1,
            ask1: data.leg1Price.ask1,
            spread: data.leg1Price.spread,
            spreadPercent: data.leg1Price.spreadPercent
          }));
        }
        
        if (data.leg2Price) {
          dispatch(updatePrice({
            symbol: data.leg2Price.symbol,
            exchange: data.leg2Price.exchange,
            timestamp: data.timestamp,
            bid1: data.leg2Price.bid1,
            ask1: data.leg2Price.ask1,
            spread: data.leg2Price.spread,
            spreadPercent: data.leg2Price.spreadPercent
          }));
        }
      }
      break;

    case 'opportunitiesFound':
      // 發現套利機會
      if (data && Array.isArray(data)) {
        data.forEach(opportunity => {
          dispatch(updateOpportunity(opportunity));
        });
        
        dispatch(addNotification({
          type: 'info',
          message: `發現 ${data.length} 個套利機會`
        }));
      }
      break;

    case 'arbitrageExecuted':
      // 套利執行完成
      if (data) {
        dispatch(addExecution({
          ...data,
          timestamp: timestamp || Date.now()
        }));
        
        const message = data.success ? '套利執行成功' : `套利執行失敗: ${data.error}`;
        dispatch(addNotification({
          type: data.success ? 'success' : 'error',
          message
        }));
      }
      break;

    case 'twapOrderExecuted':
      // TWAP訂單執行
      if (data) {
        dispatch(addTwapExecution({
          strategyId: data.strategy.id,
          leg1OrderId: data.result?.leg1OrderId,
          leg2OrderId: data.result?.leg2OrderId,
          amount: data.strategy.amountPerOrder,
          leg1Price: data.result?.leg1Price,
          leg2Price: data.result?.leg2Price,
          timestamp: timestamp || Date.now(),
          success: true
        }));
        
        dispatch(addNotification({
          type: 'success',
          message: `雙腿TWAP訂單執行成功: ${data.strategy.leg1.symbol}/${data.strategy.leg2.symbol}`
        }));
      }
      break;

    case 'pairAdded':
      // 監控交易對添加
      if (data) {
        dispatch(addNotification({
          type: 'success',
          message: `添加監控交易對: ${data.leg1.symbol} - ${data.leg2.symbol}`
        }));
      }
      break;

    case 'pairRemoved':
      // 監控交易對移除
      if (data) {
        dispatch(addNotification({
          type: 'info',
          message: `移除監控交易對: ${data.id}`
        }));
      }
      break;

    case 'twapStrategyAdded':
      // TWAP策略添加
      if (data) {
        dispatch(addNotification({
          type: 'success',
          message: `添加TWAP策略: ${data.symbol}`
        }));
      }
      break;

    case 'error':
      // 錯誤消息
      dispatch(addNotification({
        type: 'error',
        message: message.message || '發生未知錯誤'
      }));
      break;

    default:
      logger.info('未知的WebSocket消息類型', { type, data }, 'WebSocket');
  }
}

/**
 * 發送WebSocket消息
 */
export function sendWebSocketMessage(message: any) {
  if (wsRef && wsRef.readyState === WebSocket.OPEN) {
    wsRef.send(JSON.stringify(message));
  } else {
    logger.warn('WebSocket未連接，消息未發送', message, 'WebSocket');
  }
}

/**
 * 訂閱價格數據
 */
export function subscribePrice(symbol: string) {
  sendWebSocketMessage({
    type: 'subscribe',
    data: {
      channel: 'prices',
      params: { symbol }
    }
  });
}

/**
 * 取消訂閱價格數據
 */
export function unsubscribePrice(symbol: string) {
  sendWebSocketMessage({
    type: 'unsubscribe',
    data: {
      channel: 'prices',
      params: { symbol }
    }
  });
}

// 訂閱ticker（最小資料結構）
export function subscribeTicker(exchange: string, symbol: string, dispatch: AppDispatch) {
  // 優先使用WS；若不可用則使用輪詢後備
  if (wsRef && wsRef.readyState === WebSocket.OPEN) {
    sendWebSocketMessage({
      type: 'subscribe',
      data: { channel: 'ticker', params: { exchange, symbol } }
    });
    return;
  }

  // 後備：2秒輪詢
  const key = `${exchange}:${symbol}`;
  if (pollingTimers.has(key)) return;
  const timer = setInterval(async () => {
    try {
      // 這裡簡化為呼叫單價接口；若需更準確可改 batch 或監控接口
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/prices/${exchange}/${symbol}`);
      const json = await res.json();
      if (json?.success && json?.data) {
        const now = Date.now();
        // 處理訂單簿格式的數據
        const bid1 = json.data.bids?.[0] ? { price: json.data.bids[0][0], amount: json.data.bids[0][1] } : null;
        const ask1 = json.data.asks?.[0] ? { price: json.data.asks[0][0], amount: json.data.asks[0][1] } : null;
        
        dispatch(updateOpportunity({
          id: key,
          pairConfig: undefined as any,
          leg1Price: { symbol, exchange, bid1, ask1 },
          leg2Price: { symbol, exchange, bid1: null, ask1: null },
          spread: 0,
          spreadPercent: 0,
          threshold: 0,
          shouldTrigger: false,
          timestamp: now,
          direction: 'leg1_buy_leg2_sell'
        }));
      }
    } catch (e) {
      // 忽略輪詢錯誤，避免打擾使用者
    }
  }, 2000);
  pollingTimers.set(key, timer);
}

export function unsubscribeTicker(exchange: string, symbol: string) {
  const key = `${exchange}:${symbol}`;
  if (wsRef && wsRef.readyState === WebSocket.OPEN) {
    sendWebSocketMessage({
      type: 'unsubscribe',
      data: { channel: 'ticker', params: { exchange, symbol } }
    });
  }
  if (pollingTimers.has(key)) {
    clearInterval(pollingTimers.get(key));
    pollingTimers.delete(key);
  }
}
