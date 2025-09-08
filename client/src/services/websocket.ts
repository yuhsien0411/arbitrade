/**
 * WebSocket服務
 * 處理與後端的即時通訊
 */

import { AppDispatch } from '../store';
import { setConnectionStatus, addNotification, updateEngineStatus } from '../store/slices/systemSlice';
import { updateOpportunity, addExecution, setMonitoringPairs } from '../store/slices/arbitrageSlice';
import { addExecution as addTwapExecution, setStrategies } from '../store/slices/twapSlice';
import { updatePrice } from '../store/slices/pricesSlice';

/**
 * 連接WebSocket
 */
export function connectWebSocket(dispatch: AppDispatch) {
  const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
  
  // 創建WebSocket連接（使用原生WebSocket而不是socket.io）
  const wsUrl = serverUrl.replace('http', 'ws');
  const ws = new WebSocket(wsUrl);

  dispatch(setConnectionStatus('connecting'));

  ws.onopen = () => {
    console.log('WebSocket連接成功');
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
      console.error('解析WebSocket消息失敗:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket連接關閉');
    dispatch(setConnectionStatus('disconnected'));
    dispatch(addNotification({
      type: 'warning',
      message: 'WebSocket連接已關閉'
    }));
  };

  ws.onerror = (error) => {
    console.error('WebSocket連接錯誤:', error);
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
  };
}

/**
 * 處理WebSocket消息
 */
function handleWebSocketMessage(message: any, dispatch: AppDispatch) {
  const { type, data, timestamp } = message;

  switch (type) {
    case 'welcome':
      console.log('收到歡迎消息:', message.message);
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
      console.log('未知的WebSocket消息類型:', type, data);
  }
}

/**
 * 發送WebSocket消息
 */
export function sendWebSocketMessage(message: any) {
  // 這裡需要實現發送消息的邏輯
  // 由於使用原生WebSocket，需要保存WebSocket實例的引用
  console.log('發送WebSocket消息:', message);
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
