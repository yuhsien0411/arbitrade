/**
 * 套利系統後端入口
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');

// 初始化 Express 應用
const app = express();
const PORT = process.env.PORT || 5000;

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
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API路由
app.use('/api', apiRoutes);

// 啟動服務器
app.listen(PORT, () => {
    logger.info(`服務器已啟動，監聽端口 ${PORT}`);
});

// 處理未捕獲的異常
process.on('uncaughtException', (err) => {
    logger.error('未捕獲的異常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的 Promise 拒絕:', reason);
});

module.exports = app;
