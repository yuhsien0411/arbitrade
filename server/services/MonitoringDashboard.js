/**
 * 監控儀表板
 * 提供實時監控數據可視化
 */

const logger = require('../utils/logger');
const CacheManager = require('./CacheManager');

class MonitoringDashboard {
    constructor() {
        this.metrics = new Map();
        this.charts = new Map();
        this.alerts = [];
        this.historicalData = [];
        this.maxHistorySize = 1000;
        this.updateInterval = 5000; // 5秒更新間隔
        this.isRunning = false;
        this.updateTimer = null;
        this.cacheManager = new CacheManager();
    }

    /**
     * 啟動監控儀表板
     */
    async start() {
        if (this.isRunning) {
            logger.warn('監控儀表板已在運行中');
            return;
        }

        try {
            await this.cacheManager.initialize();
            this.isRunning = true;
            this.updateTimer = setInterval(() => {
                this.updateMetrics();
            }, this.updateInterval);

            logger.info('監控儀表板已啟動');
        } catch (error) {
            logger.error('啟動監控儀表板失敗:', error);
            throw error;
        }
    }

    /**
     * 停止監控儀表板
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }

        try {
            await this.cacheManager.close();
            logger.info('監控儀表板已停止');
        } catch (error) {
            logger.error('停止監控儀表板失敗:', error);
        }
    }

    /**
     * 更新指標數據
     */
    updateMetrics(metrics = {}) {
        const timestamp = Date.now();
        
        // 更新當前指標
        this.metrics.set('timestamp', timestamp);
        this.metrics.set('performance', metrics.performance || {});
        this.metrics.set('exchanges', metrics.exchanges || {});
        this.metrics.set('arbitrage', metrics.arbitrage || {});
        this.metrics.set('system', metrics.system || {});

        // 添加到歷史數據
        this.addHistoricalData({
            timestamp,
            performance: metrics.performance || {},
            exchanges: metrics.exchanges || {},
            arbitrage: metrics.arbitrage || {},
            system: metrics.system || {}
        });

        // 更新圖表數據
        this.updateChartData();
    }

    /**
     * 添加歷史數據
     */
    addHistoricalData(data) {
        this.historicalData.push(data);
        
        // 限制歷史數據大小
        if (this.historicalData.length > this.maxHistorySize) {
            this.historicalData = this.historicalData.slice(-this.maxHistorySize);
        }
    }

    /**
     * 更新圖表數據
     */
    updateChartData() {
        const now = Date.now();
        const timeWindow = 24 * 60 * 60 * 1000; // 24小時
        const cutoffTime = now - timeWindow;

        // 過濾最近24小時的數據
        const recentData = this.historicalData.filter(data => 
            data.timestamp > cutoffTime
        );

        // 生成響應時間圖表數據
        this.charts.set('responseTime', this.generateResponseTimeChart(recentData));
        
        // 生成成功率圖表數據
        this.charts.set('successRate', this.generateSuccessRateChart(recentData));
        
        // 生成內存使用圖表數據
        this.charts.set('memoryUsage', this.generateMemoryUsageChart(recentData));
        
        // 生成交易所狀態圖表數據
        this.charts.set('exchangeStatus', this.generateExchangeStatusChart(recentData));
        
        // 生成套利機會圖表數據
        this.charts.set('arbitrageOpportunities', this.generateArbitrageChart(recentData));
    }

    /**
     * 生成響應時間圖表數據
     */
    generateResponseTimeChart(data) {
        const points = data.map(item => ({
            x: item.timestamp,
            y: item.performance.averageResponseTime || 0
        }));

        return {
            title: '響應時間趨勢',
            type: 'line',
            data: points,
            yAxisLabel: '毫秒 (ms)',
            thresholds: {
                warning: 500,
                critical: 1000
            }
        };
    }

    /**
     * 生成成功率圖表數據
     */
    generateSuccessRateChart(data) {
        const points = data.map(item => ({
            x: item.timestamp,
            y: (item.performance.successRate || 0) * 100
        }));

        return {
            title: '成功率趨勢',
            type: 'line',
            data: points,
            yAxisLabel: '百分比 (%)',
            thresholds: {
                warning: 95,
                critical: 90
            }
        };
    }

    /**
     * 生成內存使用圖表數據
     */
    generateMemoryUsageChart(data) {
        const points = data.map(item => ({
            x: item.timestamp,
            y: (item.performance.memoryUsage || 0) * 100
        }));

        return {
            title: '內存使用率',
            type: 'area',
            data: points,
            yAxisLabel: '百分比 (%)',
            thresholds: {
                warning: 70,
                critical: 85
            }
        };
    }

    /**
     * 生成交易所狀態圖表數據
     */
    generateExchangeStatusChart(data) {
        const exchanges = ['bybit', 'binance'];
        const chartData = {};

        exchanges.forEach(exchange => {
            chartData[exchange] = data.map(item => ({
                x: item.timestamp,
                y: item.exchanges[exchange]?.connected ? 1 : 0
            }));
        });

        return {
            title: '交易所連接狀態',
            type: 'step',
            data: chartData,
            yAxisLabel: '連接狀態',
            yAxisRange: [0, 1]
        };
    }

    /**
     * 生成套利機會圖表數據
     */
    generateArbitrageChart(data) {
        const points = data.map(item => ({
            x: item.timestamp,
            y: item.arbitrage.opportunities || 0
        }));

        return {
            title: '套利機會數量',
            type: 'bar',
            data: points,
            yAxisLabel: '機會數量'
        };
    }

    /**
     * 生成儀表板數據
     */
    generateDashboardData() {
        return {
            timestamp: this.metrics.get('timestamp'),
            performance: this.getPerformanceMetrics(),
            exchanges: this.getExchangeMetrics(),
            arbitrage: this.getArbitrageMetrics(),
            system: this.getSystemMetrics(),
            alerts: this.getActiveAlerts(),
            charts: this.getAllCharts(),
            status: this.getDashboardStatus()
        };
    }

    /**
     * 獲取性能指標
     */
    getPerformanceMetrics() {
        const perf = this.metrics.get('performance') || {};
        return {
            responseTime: perf.averageResponseTime || 0,
            successRate: perf.successRate || 0,
            memoryUsage: perf.memoryUsage || 0,
            cpuUsage: perf.cpuUsage || 0,
            activeConnections: perf.activeConnections || 0,
            requestsPerSecond: perf.requestsPerSecond || 0,
            errorRate: perf.errorRate || 0
        };
    }

    /**
     * 獲取交易所指標
     */
    getExchangeMetrics() {
        const exchanges = this.metrics.get('exchanges') || {};
        const result = {};

        Object.keys(exchanges).forEach(exchange => {
            const exchangeData = exchanges[exchange];
            result[exchange] = {
                connected: exchangeData.connected || false,
                availableSymbols: exchangeData.availableSymbols || 0,
                lastUpdate: exchangeData.lastUpdate || null,
                responseTime: exchangeData.responseTime || 0,
                errorCount: exchangeData.errorCount || 0,
                successRate: exchangeData.successRate || 0
            };
        });

        return result;
    }

    /**
     * 獲取套利指標
     */
    getArbitrageMetrics() {
        const arbitrage = this.metrics.get('arbitrage') || {};
        return {
            opportunities: arbitrage.opportunities || 0,
            totalTrades: arbitrage.totalTrades || 0,
            successfulTrades: arbitrage.successfulTrades || 0,
            totalProfit: arbitrage.totalProfit || 0,
            averageSpread: arbitrage.averageSpread || 0,
            maxSpread: arbitrage.maxSpread || 0,
            minSpread: arbitrage.minSpread || 0
        };
    }

    /**
     * 獲取系統指標
     */
    getSystemMetrics() {
        const system = this.metrics.get('system') || {};
        const memoryUsage = process.memoryUsage();
        
        return {
            uptime: process.uptime(),
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                external: memoryUsage.external,
                rss: memoryUsage.rss
            },
            cpu: system.cpuUsage || 0,
            loadAverage: system.loadAverage || [0, 0, 0],
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };
    }

    /**
     * 獲取活躍告警
     */
    getActiveAlerts() {
        return this.alerts.filter(alert => 
            alert.status === 'active' && !alert.resolved
        );
    }

    /**
     * 獲取所有圖表數據
     */
    getAllCharts() {
        const charts = {};
        for (const [name, data] of this.charts) {
            charts[name] = data;
        }
        return charts;
    }

    /**
     * 獲取儀表板狀態
     */
    getDashboardStatus() {
        return {
            isRunning: this.isRunning,
            lastUpdate: this.metrics.get('timestamp'),
            dataPoints: this.historicalData.length,
            updateInterval: this.updateInterval,
            maxHistorySize: this.maxHistorySize
        };
    }

    /**
     * 設置告警
     */
    setAlerts(alerts) {
        this.alerts = alerts || [];
    }

    /**
     * 添加告警
     */
    addAlert(alert) {
        this.alerts.push(alert);
        
        // 限制告警數量
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-50);
        }
    }

    /**
     * 獲取歷史數據
     */
    getHistoricalData(timeRange = '1h', metric = null) {
        const now = Date.now();
        let timeWindow;

        switch (timeRange) {
            case '1h':
                timeWindow = 60 * 60 * 1000;
                break;
            case '6h':
                timeWindow = 6 * 60 * 60 * 1000;
                break;
            case '24h':
                timeWindow = 24 * 60 * 60 * 1000;
                break;
            case '7d':
                timeWindow = 7 * 24 * 60 * 60 * 1000;
                break;
            default:
                timeWindow = 60 * 60 * 1000;
        }

        const cutoffTime = now - timeWindow;
        let filteredData = this.historicalData.filter(data => 
            data.timestamp > cutoffTime
        );

        if (metric) {
            filteredData = filteredData.map(data => ({
                timestamp: data.timestamp,
                value: this.getNestedValue(data, metric)
            }));
        }

        return filteredData;
    }

    /**
     * 獲取嵌套對象值
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * 導出數據
     */
    exportData(format = 'json', timeRange = '24h') {
        const data = this.getHistoricalData(timeRange);
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            default:
                return data;
        }
    }

    /**
     * 轉換為 CSV 格式
     */
    convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = ['timestamp', 'performance', 'exchanges', 'arbitrage', 'system'];
        const csvRows = [headers.join(',')];

        data.forEach(item => {
            const row = [
                new Date(item.timestamp).toISOString(),
                JSON.stringify(item.performance),
                JSON.stringify(item.exchanges),
                JSON.stringify(item.arbitrage),
                JSON.stringify(item.system)
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * 清理舊數據
     */
    cleanup() {
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前
        this.historicalData = this.historicalData.filter(data => 
            data.timestamp > cutoffTime
        );

        // 清理舊告警
        this.alerts = this.alerts.filter(alert => 
            alert.timestamp > cutoffTime
        );

        logger.info('監控儀表板數據清理完成');
    }

    /**
     * 獲取服務狀態
     */
    getStatus() {
        return {
            enabled: this.isRunning,
            lastUpdate: this.metrics.get('timestamp'),
            dataPoints: this.historicalData.length,
            activeAlerts: this.getActiveAlerts().length,
            charts: Object.keys(this.getAllCharts()),
            status: this.getDashboardStatus(),
            cache: this.cacheManager.getStats()
        };
    }

    /**
     * 緩存圖表數據
     */
    async cacheChartData(chartId, data) {
        try {
            const cacheKey = `chart:${chartId}`;
            await this.cacheManager.set(cacheKey, data, 300); // 緩存5分鐘
        } catch (error) {
            logger.error('緩存圖表數據失敗:', error);
        }
    }

    /**
     * 從緩存獲取圖表數據
     */
    async getCachedChartData(chartId) {
        try {
            const cacheKey = `chart:${chartId}`;
            return await this.cacheManager.get(cacheKey);
        } catch (error) {
            logger.error('獲取緩存圖表數據失敗:', error);
            return null;
        }
    }

    /**
     * 緩存歷史數據
     */
    async cacheHistoricalData(data) {
        try {
            const cacheKey = `historical:${Date.now()}`;
            await this.cacheManager.set(cacheKey, data, 3600); // 緩存1小時
        } catch (error) {
            logger.error('緩存歷史數據失敗:', error);
        }
    }
}

module.exports = MonitoringDashboard;
