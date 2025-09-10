/**
 * 性能監控服務
 * 監控跨交易所套利系統的性能指標
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const AlertService = require('./AlertService');
const CacheManager = require('./CacheManager');

class PerformanceMonitor extends EventEmitter {
    constructor() {
        super();
        
        // 性能指標
        this.metrics = {
            // 響應時間
            responseTimes: {
                bybit: [],
                binance: [],
                crossExchange: []
            },
            
            // 成功率
            successRates: {
                bybit: { success: 0, total: 0 },
                binance: { success: 0, total: 0 },
                crossExchange: { success: 0, total: 0 }
            },
            
            // 連接狀態
            connectionStatus: {
                bybit: { connected: false, lastCheck: null, uptime: 0 },
                binance: { connected: false, lastCheck: null, uptime: 0 }
            },
            
            // 套利機會統計
            arbitrageStats: {
                opportunitiesFound: 0,
                opportunitiesExecuted: 0,
                totalProfit: 0,
                averageSpread: 0,
                spreads: []
            },
            
            // 系統資源
            systemResources: {
                memoryUsage: 0,
                cpuUsage: 0,
                activeConnections: 0
            }
        };
        
        // 監控配置
        this.config = {
            maxResponseTime: 1000, // 最大響應時間 (ms)
            minSuccessRate: 0.95, // 最小成功率
            checkInterval: 5000, // 檢查間隔 (ms)
            maxMemoryUsage: 500 * 1024 * 1024, // 最大內存使用 (bytes)
            alertThresholds: {
                responseTime: 2000,
                successRate: 0.9,
                memoryUsage: 400 * 1024 * 1024
            }
        };
        
        // 監控狀態
        this.isMonitoring = false;
        this.monitoringInterval = null;
        
        // 告警服務
        this.alertService = new AlertService();
        
        // 緩存管理器
        this.cacheManager = new CacheManager();
        
        // 事件監聽器
        this.setupEventListeners();
    }
    
    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        // 監聽套利引擎事件
        process.on('arbitrageEngine:opportunityFound', (data) => {
            this.recordArbitrageOpportunity(data);
        });
        
        process.on('arbitrageEngine:arbitrageExecuted', (data) => {
            this.recordArbitrageExecution(data);
        });
        
        process.on('exchange:responseTime', (data) => {
            this.recordResponseTime(data.exchange, data.responseTime);
        });
        
        process.on('exchange:connectionStatus', (data) => {
            this.updateConnectionStatus(data.exchange, data.connected);
        });
    }
    
    /**
     * 開始性能監控
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            logger.warn('性能監控已在運行中');
            return;
        }
        
        // 初始化緩存管理器
        try {
            await this.cacheManager.initialize();
            logger.info('緩存管理器初始化成功');
        } catch (error) {
            logger.warn('緩存管理器初始化失敗，將使用內存緩存:', error.message);
        }
        
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.checkInterval);
        
        logger.info('性能監控已啟動');
        this.emit('monitoringStarted');
    }
    
    /**
     * 停止性能監控
     */
    async stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // 關閉緩存管理器
        try {
            await this.cacheManager.close();
            logger.info('緩存管理器已關閉');
        } catch (error) {
            logger.error('關閉緩存管理器失敗:', error);
        }
        
        logger.info('性能監控已停止');
        this.emit('monitoringStopped');
    }
    
    /**
     * 記錄響應時間
     */
    recordResponseTime(exchange, responseTime) {
        if (!this.metrics.responseTimes[exchange]) {
            this.metrics.responseTimes[exchange] = [];
        }
        
        this.metrics.responseTimes[exchange].push({
            time: Date.now(),
            duration: responseTime
        });
        
        // 保持最近 100 個記錄
        if (this.metrics.responseTimes[exchange].length > 100) {
            this.metrics.responseTimes[exchange].shift();
        }
        
        // 檢查是否超過閾值
        if (responseTime > this.config.alertThresholds.responseTime) {
            this.emit('alert', {
                type: 'highResponseTime',
                exchange,
                value: responseTime,
                threshold: this.config.alertThresholds.responseTime
            });
        }
    }
    
    /**
     * 記錄成功率
     */
    recordSuccess(exchange, success) {
        if (!this.metrics.successRates[exchange]) {
            this.metrics.successRates[exchange] = { success: 0, total: 0 };
        }
        
        this.metrics.successRates[exchange].total++;
        if (success) {
            this.metrics.successRates[exchange].success++;
        }
        
        // 檢查成功率是否過低
        const successRate = this.metrics.successRates[exchange].success / this.metrics.successRates[exchange].total;
        if (successRate < this.config.alertThresholds.successRate) {
            this.emit('alert', {
                type: 'lowSuccessRate',
                exchange,
                value: successRate,
                threshold: this.config.alertThresholds.successRate
            });
        }
    }
    
    /**
     * 更新連接狀態
     */
    updateConnectionStatus(exchange, connected) {
        const status = this.metrics.connectionStatus[exchange];
        const now = Date.now();
        
        if (status.connected !== connected) {
            if (connected) {
                status.uptime = now;
                logger.info(`${exchange} 交易所已連接`);
            } else {
                const uptime = now - status.uptime;
                logger.warn(`${exchange} 交易所連接中斷，運行時間: ${uptime}ms`);
            }
        }
        
        status.connected = connected;
        status.lastCheck = now;
        
        this.emit('connectionStatusChanged', { exchange, connected });
    }
    
    /**
     * 記錄套利機會
     */
    recordArbitrageOpportunity(data) {
        this.metrics.arbitrageStats.opportunitiesFound++;
        this.metrics.arbitrageStats.spreads.push(data.spreadPercent);
        
        // 保持最近 1000 個價差記錄
        if (this.metrics.arbitrageStats.spreads.length > 1000) {
            this.metrics.arbitrageStats.spreads.shift();
        }
        
        // 計算平均價差
        const total = this.metrics.arbitrageStats.spreads.reduce((sum, spread) => sum + spread, 0);
        this.metrics.arbitrageStats.averageSpread = total / this.metrics.arbitrageStats.spreads.length;
        
        this.emit('opportunityRecorded', data);
    }
    
    /**
     * 記錄套利執行
     */
    recordArbitrageExecution(success, executionTime, profit) {
        this.metrics.arbitrageStats.opportunitiesExecuted++;
        
        if (success && profit) {
            this.metrics.arbitrageStats.totalProfit += profit;
        }
        
        this.emit('executionRecorded', { success, executionTime, profit });
    }

    /**
     * 記錄錯誤
     */
    recordError(errorType, errorMessage) {
        if (!this.metrics.errors) {
            this.metrics.errors = [];
        }
        
        this.metrics.errors.push({
            type: errorType,
            message: errorMessage,
            timestamp: Date.now()
        });
        
        // 保持最近 100 個錯誤記錄
        if (this.metrics.errors.length > 100) {
            this.metrics.errors.shift();
        }
        
        this.emit('errorRecorded', { type: errorType, message: errorMessage });
    }
    
    /**
     * 執行健康檢查
     */
    performHealthCheck() {
        const health = {
            timestamp: Date.now(),
            status: 'healthy',
            issues: [],
            metrics: this.getMetrics()
        };

        // 準備告警檢查的指標數據
        const alertMetrics = this.prepareAlertMetrics();
        
        // 檢查響應時間
        for (const [exchange, times] of Object.entries(this.metrics.responseTimes)) {
            if (times.length > 0) {
                const avgTime = times.reduce((sum, t) => sum + t.duration, 0) / times.length;
                if (avgTime > this.config.maxResponseTime) {
                    health.issues.push({
                        type: 'highResponseTime',
                        exchange,
                        value: avgTime,
                        threshold: this.config.maxResponseTime
                    });
                }
            }
        }
        
        // 檢查成功率
        for (const [exchange, rate] of Object.entries(this.metrics.successRates)) {
            if (rate.total > 0) {
                const successRate = rate.success / rate.total;
                if (successRate < this.config.minSuccessRate) {
                    health.issues.push({
                        type: 'lowSuccessRate',
                        exchange,
                        value: successRate,
                        threshold: this.config.minSuccessRate
                    });
                }
            }
        }
        
        // 檢查連接狀態
        for (const [exchange, status] of Object.entries(this.metrics.connectionStatus)) {
            if (!status.connected) {
                health.issues.push({
                    type: 'disconnected',
                    exchange,
                    lastCheck: status.lastCheck
                });
            }
        }
        
        // 檢查系統資源
        const memUsage = process.memoryUsage();
        this.metrics.systemResources.memoryUsage = memUsage.heapUsed;
        
        if (memUsage.heapUsed > this.config.alertThresholds.memoryUsage) {
            health.issues.push({
                type: 'highMemoryUsage',
                value: memUsage.heapUsed,
                threshold: this.config.alertThresholds.memoryUsage
            });
        }
        
        // 確定整體健康狀態
        if (health.issues.length > 0) {
            health.status = health.issues.some(issue => 
                issue.type === 'disconnected' || issue.type === 'lowSuccessRate'
            ) ? 'critical' : 'warning';
        }
        
        this.emit('healthCheck', health);
        
        // 檢查告警條件
        this.alertService.checkAlerts(alertMetrics);

        // 如果有問題，發送警報
        if (health.issues.length > 0) {
            this.emit('alert', {
                type: 'healthCheck',
                health
            });
        }
    }

    /**
     * 準備告警檢查的指標數據
     */
    prepareAlertMetrics() {
        const metrics = this.getMetrics();
        const memUsage = process.memoryUsage();
        
        // 計算平均響應時間
        let totalResponseTime = 0;
        let responseTimeCount = 0;
        for (const [exchange, times] of Object.entries(metrics.responseTimes)) {
            if (times.average) {
                totalResponseTime += times.average;
                responseTimeCount++;
            }
        }
        const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

        // 計算總體成功率
        let totalSuccess = 0;
        let totalRequests = 0;
        for (const [exchange, rate] of Object.entries(metrics.successRates)) {
            totalSuccess += rate.success || 0;
            totalRequests += rate.total || 0;
        }
        const successRate = totalRequests > 0 ? totalSuccess / totalRequests : 1;

        // 計算內存使用率
        const memoryUsage = memUsage.heapUsed / memUsage.heapTotal;

        return {
            performance: {
                averageResponseTime,
                successRate,
                memoryUsage,
                cpuUsage: this.metrics.systemResources.cpuUsage,
                activeConnections: this.metrics.systemResources.activeConnections
            },
            exchanges: {
                bybit: {
                    connected: metrics.connectionStatus.bybit.connected,
                    availableSymbols: 2, // 假設值
                    responseTime: metrics.responseTimes.bybit?.average || 0,
                    successRate: metrics.successRates.bybit?.rate || 1
                },
                binance: {
                    connected: metrics.connectionStatus.binance.connected,
                    availableSymbols: 2, // 假設值
                    responseTime: metrics.responseTimes.binance?.average || 0,
                    successRate: metrics.successRates.binance?.rate || 1
                }
            },
            arbitrage: {
                opportunities: metrics.arbitrageStats.opportunitiesFound,
                totalTrades: metrics.arbitrageStats.opportunitiesExecuted,
                successfulTrades: metrics.arbitrageStats.opportunitiesExecuted,
                totalProfit: metrics.arbitrageStats.totalProfit,
                averageSpread: metrics.arbitrageStats.averageSpread
            },
            system: {
                memoryUsage,
                cpuUsage: this.metrics.systemResources.cpuUsage,
                uptime: process.uptime()
            }
        };
    }
    
    /**
     * 獲取性能指標
     */
    getMetrics() {
        const metrics = { ...this.metrics };
        
        // 計算平均響應時間
        for (const [exchange, times] of Object.entries(metrics.responseTimes)) {
            if (times.length > 0) {
                metrics.responseTimes[exchange] = {
                    average: times.reduce((sum, t) => sum + t.duration, 0) / times.length,
                    min: Math.min(...times.map(t => t.duration)),
                    max: Math.max(...times.map(t => t.duration)),
                    count: times.length
                };
            }
        }
        
        // 計算成功率
        for (const [exchange, rate] of Object.entries(metrics.successRates)) {
            if (rate.total > 0) {
                metrics.successRates[exchange] = {
                    ...rate,
                    rate: rate.success / rate.total
                };
            }
        }
        
        // 計算連接運行時間
        for (const [exchange, status] of Object.entries(metrics.connectionStatus)) {
            if (status.connected && status.uptime) {
                status.uptime = Date.now() - status.uptime;
            }
        }
        
        return metrics;
    }
    
    /**
     * 獲取性能報告
     */
    getPerformanceReport() {
        const metrics = this.getMetrics();
        const now = Date.now();
        
        return {
            timestamp: now,
            summary: {
                totalOpportunities: metrics.arbitrageStats.opportunitiesFound,
                executedOpportunities: metrics.arbitrageStats.opportunitiesExecuted,
                executionRate: metrics.arbitrageStats.opportunitiesFound > 0 ? 
                    metrics.arbitrageStats.opportunitiesExecuted / metrics.arbitrageStats.opportunitiesFound : 0,
                totalProfit: metrics.arbitrageStats.totalProfit,
                averageSpread: metrics.arbitrageStats.averageSpread
            },
            exchanges: {
                bybit: {
                    connected: metrics.connectionStatus.bybit.connected,
                    uptime: metrics.connectionStatus.bybit.uptime,
                    responseTime: metrics.responseTimes.bybit,
                    successRate: metrics.successRates.bybit
                },
                binance: {
                    connected: metrics.connectionStatus.binance.connected,
                    uptime: metrics.connectionStatus.binance.uptime,
                    responseTime: metrics.responseTimes.binance,
                    successRate: metrics.successRates.binance
                }
            },
            system: {
                memoryUsage: metrics.systemResources.memoryUsage,
                uptime: process.uptime() * 1000
            }
        };
    }
    
    /**
     * 重置指標
     */
    resetMetrics() {
        this.metrics = {
            responseTimes: { bybit: [], binance: [], crossExchange: [] },
            successRates: { bybit: { success: 0, total: 0 }, binance: { success: 0, total: 0 }, crossExchange: { success: 0, total: 0 } },
            connectionStatus: { bybit: { connected: false, lastCheck: null, uptime: 0 }, binance: { connected: false, lastCheck: null, uptime: 0 } },
            arbitrageStats: { opportunitiesFound: 0, opportunitiesExecuted: 0, totalProfit: 0, averageSpread: 0, spreads: [] },
            systemResources: { memoryUsage: 0, cpuUsage: 0, activeConnections: 0 }
        };
        
        logger.info('性能指標已重置');
        this.emit('metricsReset');
    }

    /**
     * 獲取告警服務
     */
    getAlertService() {
        return this.alertService;
    }

    /**
     * 獲取告警統計
     */
    getAlertStats() {
        return this.alertService.getAlertStats();
    }

    /**
     * 獲取活躍告警
     */
    getActiveAlerts() {
        return this.alertService.getActiveAlerts();
    }

    /**
     * 獲取緩存管理器
     */
    getCacheManager() {
        return this.cacheManager;
    }

    /**
     * 獲取緩存統計
     */
    getCacheStats() {
        return this.cacheManager.getStats();
    }

    /**
     * 獲取監控狀態
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            metrics: this.getMetrics(),
            config: this.config,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * 緩存性能指標
     */
    async cachePerformanceMetrics(metrics) {
        try {
            const cacheKey = `performance:${Date.now()}`;
            await this.cacheManager.set(cacheKey, metrics, 60); // 緩存1分鐘
        } catch (error) {
            logger.error('緩存性能指標失敗:', error);
        }
    }

    /**
     * 從緩存獲取性能指標
     */
    async getCachedPerformanceMetrics(key) {
        try {
            return await this.cacheManager.get(`performance:${key}`);
        } catch (error) {
            logger.error('獲取緩存性能指標失敗:', error);
            return null;
        }
    }
}

// 單例模式
let instance = null;

function getPerformanceMonitor() {
    if (!instance) {
        instance = new PerformanceMonitor();
    }
    return instance;
}

module.exports = {
    PerformanceMonitor,
    getPerformanceMonitor
};
