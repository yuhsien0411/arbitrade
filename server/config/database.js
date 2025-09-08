/**
 * 數據庫配置模組
 * 負責MongoDB和Redis連接管理
 */

const mongoose = require('mongoose');
const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * 連接MongoDB數據庫
 */
async function connectDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arbitrage_trading';
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        logger.info('MongoDB 連接成功');

        // 監聽連接事件
        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB 連接錯誤:', error);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB 連接斷開');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB 重新連接成功');
        });

    } catch (error) {
        logger.error('MongoDB 連接失敗:', error);
        throw error;
    }
}

/**
 * 連接Redis緩存
 */
async function connectRedis() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        
        redisClient = redis.createClient({
            url: redisUrl,
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    logger.error('Redis 服務器拒絕連接');
                    return new Error('Redis 服務器拒絕連接');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    logger.error('Redis 重試時間超過1小時，停止重試');
                    return new Error('重試時間過長');
                }
                if (options.attempt > 10) {
                    logger.error('Redis 重試次數超過10次，停止重試');
                    return undefined;
                }
                // 重新連接延遲時間遞增
                return Math.min(options.attempt * 100, 3000);
            }
        });

        redisClient.on('error', (error) => {
            logger.error('Redis 連接錯誤:', error);
        });

        redisClient.on('connect', () => {
            logger.info('Redis 連接成功');
        });

        redisClient.on('reconnecting', () => {
            logger.info('Redis 重新連接中...');
        });

        await redisClient.connect();

    } catch (error) {
        logger.error('Redis 連接失敗:', error);
        throw error;
    }
}

/**
 * 獲取Redis客戶端實例
 */
function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis 客戶端未初始化');
    }
    return redisClient;
}

/**
 * 優雅關閉數據庫連接
 */
async function closeConnections() {
    try {
        if (redisClient) {
            await redisClient.quit();
            logger.info('Redis 連接已關閉');
        }
        
        await mongoose.connection.close();
        logger.info('MongoDB 連接已關閉');
        
    } catch (error) {
        logger.error('關閉數據庫連接時發生錯誤:', error);
    }
}

module.exports = {
    connectDatabase,
    connectRedis,
    getRedisClient,
    closeConnections
};
