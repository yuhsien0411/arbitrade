/**
 * 套利系統後端入口
 */

require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');
const CacheManager = require('./services/CacheManager');
const { handleConnection } = require('./websocket/handler');
const { startArbitrageEngine } = require('./services/arbitrageEngine');
const OrderBookMonitor = require('./services/OrderBookMonitor');

// 初始化 Express 應用
const app = express();
const PORT = process.env.PORT || 5000;

// 創建 HTTP 服務器
const server = http.createServer(app);

// 創建 WebSocket 服務器
const wss = new WebSocket.Server({ server });

// 創建訂單簿監控服務
const orderBookMonitor = new OrderBookMonitor();

// 中間件
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康檢查端點
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        websocket: {
            connections: wss.clients.size,
            status: 'active'
        }
    });
});

// API路由
app.use('/api', apiRoutes);

// WebSocket 連接處理
wss.on('connection', (ws, req) => {
    handleConnection(ws, req);
});

// 啟動套利引擎
async function startSystem() {
    try {
        logger.info('正在啟動套利系統...');
        
        // 啟動前清空 API 與內部快取，確保乾淨狀態
        try {
            const startupCache = new CacheManager();
            await startupCache.initialize();
            await startupCache.flush();
            logger.info('✅ 啟動前已清空所有緩存');
        } catch (e) {
            logger.warn('啟動前清空緩存失敗，將繼續啟動（可能使用內存快取）:', e.message);
        }

        // 啟動套利引擎
        await startArbitrageEngine();
        logger.info('✅ 套利引擎啟動成功');
        
        // 啟動訂單簿監控服務
        await orderBookMonitor.start();
        logger.info('✅ 訂單簿監控服務啟動成功');
        
        // 設置監控事件監聽器
        orderBookMonitor.on('arbitrageOpportunity', (data) => {
            logger.info(`[OrderBookMonitor] 發現套利機會: ${data.pairId}`, {
                spread: data.opportunity.spreadPercent.toFixed(3) + '%',
                shouldTrigger: data.opportunity.shouldTrigger
            });
        });
        
        orderBookMonitor.on('arbitrageTrigger', (data) => {
            logger.warn(`[OrderBookMonitor] 套利觸發: ${data.pairId}`, {
                spread: data.opportunity.spreadPercent.toFixed(3) + '%',
                threshold: data.pair.threshold + '%'
            });
        });
        
        // 啟動服務器
        server.listen(PORT, () => {
            logger.info(`✅ 服務器已啟動，監聽端口 ${PORT}`);
            logger.info(`✅ WebSocket 服務已啟動`);
            logger.info(`✅ 訂單簿監控服務已啟動`);
            logger.info(`✅ 系統完全啟動完成`);
        });
        
    } catch (error) {
        logger.error('❌ 系統啟動失敗:', error);
        process.exit(1);
    }
}

// 啟動系統
startSystem();

// 處理未捕獲的異常
process.on('uncaughtException', (err) => {
    logger.error('未捕獲的異常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的 Promise 拒絕:', reason);
});

module.exports = app;

