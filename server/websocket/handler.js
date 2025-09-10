/**
 * WebSocket處理器
 * 提供即時數據推送功能
 * 
 * 功能：
 * - 即時價格推送
 * - 套利機會通知
 * - 交易狀態更新
 * - TWAP執行進度
 */

const { getArbitrageEngine } = require('../services/arbitrageEngine');
const logger = require('../utils/logger');

// 存儲所有WebSocket連接
const connections = new Set();

/**
 * WebSocket連接處理器
 */
function handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    logger.info('🔌 [WebSocket] 客戶端連接', { 
      clientIp,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    // 添加到連接集合
    connections.add(ws);
    logger.info(`📊 [WebSocket] 當前連接數: ${connections.size}`);

    // 發送歡迎消息
    const welcomeMessage = {
        type: 'welcome',
        message: '歡迎使用雙腿套利交易系統',
        timestamp: Date.now()
    };
    ws.send(JSON.stringify(welcomeMessage));
    logger.info('📤 [WebSocket] 發送歡迎消息:', welcomeMessage);

    // 獲取套利引擎實例
    const engine = getArbitrageEngine();
    if (engine) {
        setupEngineEventListeners(ws, engine);
        
        // 發送初始狀態
        const status = engine.getStatus();
        ws.send(JSON.stringify({
            type: 'status',
            data: status,
            timestamp: Date.now()
        }));
    }

    // 處理客戶端消息
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            // 處理前端日誌消息
            if (message.type === 'log') {
                const logEntry = message.data;
                logger.info(`📱 [Frontend Log] ${logEntry.level.toUpperCase()}`, {
                    message: logEntry.message,
                    data: logEntry.data,
                    source: logEntry.source,
                    url: logEntry.url,
                    timestamp: logEntry.timestamp,
                    clientIp
                });
                return; // 不繼續處理其他邏輯
            }
            
            logger.info('📨 [WebSocket] 收到客戶端消息:', {
              type: message.type,
              data: message.data,
              clientIp,
              timestamp: new Date().toISOString()
            });
            handleClientMessage(ws, message);
        } catch (error) {
            logger.error('❌ [WebSocket] 解析消息失敗:', error);
            const errorResponse = {
                type: 'error',
                message: '消息格式錯誤',
                timestamp: Date.now()
            };
            ws.send(JSON.stringify(errorResponse));
            logger.info('📤 [WebSocket] 發送錯誤響應:', errorResponse);
        }
    });

    // 處理連接關閉
    ws.on('close', () => {
        connections.delete(ws);
        logger.info('🔌 [WebSocket] 客戶端斷開連接', { 
          clientIp,
          remainingConnections: connections.size,
          timestamp: new Date().toISOString()
        });
    });

    // 處理連接錯誤
    ws.on('error', (error) => {
        logger.error('❌ [WebSocket] 連接錯誤:', {
          error: error.message,
          clientIp,
          timestamp: new Date().toISOString()
        });
        connections.delete(ws);
    });

    // 心跳檢測
    const heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            }));
        } else {
            clearInterval(heartbeat);
        }
    }, 30000); // 每30秒發送一次心跳
}

/**
 * 設置引擎事件監聽器
 */
function setupEngineEventListeners(ws, engine) {
    // 價格更新事件
    const onPriceUpdate = (opportunity) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'priceUpdate',
                data: opportunity,
                timestamp: Date.now()
            }));
        }
    };

    // 發現套利機會事件
    const onOpportunitiesFound = (opportunities) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'opportunitiesFound',
                data: opportunities,
                timestamp: Date.now()
            }));
        }
    };

    // 套利執行完成事件
    const onArbitrageExecuted = (result) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'arbitrageExecuted',
                data: result,
                timestamp: Date.now()
            }));
        }
    };

    // TWAP訂單執行事件
    const onTwapOrderExecuted = (result) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'twapOrderExecuted',
                data: result,
                timestamp: Date.now()
            }));
        }
    };

    // 監控交易對添加事件
    const onPairAdded = (pair) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'pairAdded',
                data: pair,
                timestamp: Date.now()
            }));
        }
    };

    // 監控交易對更新事件
    const onPairUpdated = (pair) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'pairUpdated',
                data: pair,
                timestamp: Date.now()
            }));
        }
    };

    // 監控交易對移除事件
    const onPairRemoved = (pairInfo) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'pairRemoved',
                data: pairInfo,
                timestamp: Date.now()
            }));
        }
    };

    // TWAP策略添加事件
    const onTwapStrategyAdded = (strategy) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'twapStrategyAdded',
                data: strategy,
                timestamp: Date.now()
            }));
        }
    };

    // 註冊事件監聽器
    engine.on('priceUpdate', onPriceUpdate);
    engine.on('opportunitiesFound', onOpportunitiesFound);
    engine.on('arbitrageExecuted', onArbitrageExecuted);
    engine.on('twapOrderExecuted', onTwapOrderExecuted);
    engine.on('pairAdded', onPairAdded);
    engine.on('pairUpdated', onPairUpdated);
    engine.on('pairRemoved', onPairRemoved);
    engine.on('twapStrategyAdded', onTwapStrategyAdded);

    // 在WebSocket關閉時移除監聽器
    ws.on('close', () => {
        engine.removeListener('priceUpdate', onPriceUpdate);
        engine.removeListener('opportunitiesFound', onOpportunitiesFound);
        engine.removeListener('arbitrageExecuted', onArbitrageExecuted);
        engine.removeListener('twapOrderExecuted', onTwapOrderExecuted);
        engine.removeListener('pairAdded', onPairAdded);
        engine.removeListener('pairUpdated', onPairUpdated);
        engine.removeListener('pairRemoved', onPairRemoved);
        engine.removeListener('twapStrategyAdded', onTwapStrategyAdded);
    });
}

/**
 * 處理客戶端消息
 */
function handleClientMessage(ws, message) {
    const { type, data } = message;

    switch (type) {
        case 'pong':
            // 心跳回應，不需要處理
            break;

        case 'subscribe':
            // 訂閱特定數據流
            handleSubscription(ws, data);
            break;

        case 'unsubscribe':
            // 取消訂閱
            handleUnsubscription(ws, data);
            break;

        case 'requestStatus':
            // 請求當前狀態
            const engine = getArbitrageEngine();
            if (engine) {
                const status = engine.getStatus();
                ws.send(JSON.stringify({
                    type: 'status',
                    data: status,
                    timestamp: Date.now()
                }));
            }
            break;

        default:
            logger.warn('未知的WebSocket消息類型:', type);
            ws.send(JSON.stringify({
                type: 'error',
                message: `未知的消息類型: ${type}`,
                timestamp: Date.now()
            }));
    }
}

/**
 * 處理訂閱請求
 */
function handleSubscription(ws, data) {
    const { channel, params } = data;

    switch (channel) {
        case 'prices':
            // 訂閱價格數據
            if (!ws.subscriptions) {
                ws.subscriptions = new Set();
            }
            ws.subscriptions.add(`prices:${params.symbol}`);
            logger.info(`客戶端訂閱價格數據: ${params.symbol}`);
            break;

        case 'arbitrage':
            // 訂閱套利機會
            if (!ws.subscriptions) {
                ws.subscriptions = new Set();
            }
            ws.subscriptions.add('arbitrage');
            logger.info('客戶端訂閱套利機會');
            break;

        case 'twap':
            // 訂閱TWAP執行狀態
            if (!ws.subscriptions) {
                ws.subscriptions = new Set();
            }
            ws.subscriptions.add('twap');
            logger.info('客戶端訂閱TWAP狀態');
            break;

        default:
            logger.warn('未知的訂閱頻道:', channel);
    }
}

/**
 * 處理取消訂閱請求
 */
function handleUnsubscription(ws, data) {
    const { channel, params } = data;

    if (!ws.subscriptions) {
        return;
    }

    switch (channel) {
        case 'prices':
            ws.subscriptions.delete(`prices:${params.symbol}`);
            logger.info(`客戶端取消訂閱價格數據: ${params.symbol}`);
            break;

        case 'arbitrage':
            ws.subscriptions.delete('arbitrage');
            logger.info('客戶端取消訂閱套利機會');
            break;

        case 'twap':
            ws.subscriptions.delete('twap');
            logger.info('客戶端取消訂閱TWAP狀態');
            break;
    }
}

/**
 * 廣播消息給所有連接的客戶端
 */
function broadcast(message) {
    const data = JSON.stringify(message);
    
    connections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
            ws.send(data);
        }
    });
}

/**
 * 向特定訂閱者發送消息
 */
function sendToSubscribers(channel, message) {
    const data = JSON.stringify(message);
    
    connections.forEach(ws => {
        if (ws.readyState === ws.OPEN && 
            ws.subscriptions && 
            ws.subscriptions.has(channel)) {
            ws.send(data);
        }
    });
}

/**
 * 獲取連接統計
 */
function getConnectionStats() {
    return {
        totalConnections: connections.size,
        activeConnections: Array.from(connections).filter(ws => ws.readyState === ws.OPEN).length
    };
}

module.exports = {
    handleConnection,
    broadcast,
    sendToSubscribers,
    getConnectionStats
};
