/**
 * 監控 API 路由
 * 提供監控數據和告警管理接口
 */

const express = require('express');
const router = express.Router();
const { getPerformanceMonitor } = require('../services/PerformanceMonitor');
const MonitoringDashboard = require('../services/MonitoringDashboard');
const CacheManager = require('../services/CacheManager');
const logger = require('../utils/logger');

// 創建監控儀表板實例
const dashboard = new MonitoringDashboard();

// 創建緩存管理器實例
const cacheManager = new CacheManager();

// 啟動監控儀表板
dashboard.start();

/**
 * 獲取監控儀表板數據
 */
router.get('/dashboard', async (req, res) => {
    try {
        const dashboardData = dashboard.generateDashboardData();
        res.json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        logger.error('獲取監控儀表板數據失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取監控儀表板數據失敗'
        });
    }
});

/**
 * 獲取性能指標
 */
router.get('/metrics', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        const metrics = monitor.getMetrics();
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('獲取性能指標失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取性能指標失敗'
        });
    }
});

/**
 * 獲取性能報告
 */
router.get('/report', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        const report = monitor.getPerformanceReport();
        
        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        logger.error('獲取性能報告失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取性能報告失敗'
        });
    }
});

/**
 * 獲取告警統計
 */
router.get('/alerts/stats', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        const stats = monitor.getAlertStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('獲取告警統計失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取告警統計失敗'
        });
    }
});

/**
 * 獲取活躍告警
 */
router.get('/alerts/active', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        const alerts = monitor.getActiveAlerts();
        
        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        logger.error('獲取活躍告警失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取活躍告警失敗'
        });
    }
});

/**
 * 獲取告警歷史
 */
router.get('/alerts/history', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        const alertService = monitor.getAlertService();
        
        const limit = parseInt(req.query.limit) || 100;
        const severity = req.query.severity || null;
        
        const history = alertService.getAlertHistory(limit, severity);
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        logger.error('獲取告警歷史失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取告警歷史失敗'
        });
    }
});

/**
 * 解決告警
 */
router.post('/alerts/:alertId/resolve', async (req, res) => {
    try {
        const { alertId } = req.params;
        const monitor = getPerformanceMonitor();
        const alertService = monitor.getAlertService();
        
        const resolved = alertService.resolveAlert(alertId);
        
        if (resolved) {
            res.json({
                success: true,
                message: '告警已解決'
            });
        } else {
            res.status(404).json({
                success: false,
                error: '告警不存在'
            });
        }
    } catch (error) {
        logger.error('解決告警失敗:', error);
        res.status(500).json({
            success: false,
            error: '解決告警失敗'
        });
    }
});

/**
 * 添加告警規則
 */
router.post('/alerts/rules', async (req, res) => {
    try {
        const rule = req.body;
        const monitor = getPerformanceMonitor();
        const alertService = monitor.getAlertService();
        
        alertService.addAlertRule(rule);
        
        res.json({
            success: true,
            message: '告警規則已添加'
        });
    } catch (error) {
        logger.error('添加告警規則失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 移除告警規則
 */
router.delete('/alerts/rules/:ruleId', async (req, res) => {
    try {
        const { ruleId } = req.params;
        const monitor = getPerformanceMonitor();
        const alertService = monitor.getAlertService();
        
        const removed = alertService.removeAlertRule(ruleId);
        
        if (removed) {
            res.json({
                success: true,
                message: '告警規則已移除'
            });
        } else {
            res.status(404).json({
                success: false,
                error: '告警規則不存在'
            });
        }
    } catch (error) {
        logger.error('移除告警規則失敗:', error);
        res.status(500).json({
            success: false,
            error: '移除告警規則失敗'
        });
    }
});

/**
 * 獲取圖表數據
 */
router.get('/charts/:chartType', async (req, res) => {
    try {
        const { chartType } = req.params;
        const timeRange = req.query.timeRange || '24h';
        
        const chartData = dashboard.getHistoricalData(timeRange, chartType);
        
        res.json({
            success: true,
            data: chartData
        });
    } catch (error) {
        logger.error('獲取圖表數據失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取圖表數據失敗'
        });
    }
});

/**
 * 導出監控數據
 */
router.get('/export', async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const timeRange = req.query.timeRange || '24h';
        
        const data = dashboard.exportData(format, timeRange);
        
        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="monitoring_data_${Date.now()}.${format}"`);
        
        res.send(data);
    } catch (error) {
        logger.error('導出監控數據失敗:', error);
        res.status(500).json({
            success: false,
            error: '導出監控數據失敗'
        });
    }
});

/**
 * 獲取系統健康狀態
 */
router.get('/health', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        const metrics = monitor.getMetrics();
        const alerts = monitor.getActiveAlerts();
        
        const health = {
            status: 'healthy',
            timestamp: Date.now(),
            metrics: {
                responseTime: metrics.responseTimes,
                successRate: metrics.successRates,
                connectionStatus: metrics.connectionStatus,
                systemResources: metrics.systemResources
            },
            alerts: {
                active: alerts.length,
                critical: alerts.filter(a => a.severity === 'critical').length
            }
        };

        // 檢查是否有嚴重問題
        const hasCriticalAlerts = alerts.some(a => a.severity === 'critical');
        const hasDisconnectedExchanges = Object.values(metrics.connectionStatus).some(s => !s.connected);
        
        if (hasCriticalAlerts || hasDisconnectedExchanges) {
            health.status = 'unhealthy';
        }

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        logger.error('獲取系統健康狀態失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取系統健康狀態失敗'
        });
    }
});

/**
 * 重置性能指標
 */
router.post('/reset', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        monitor.resetMetrics();
        
        res.json({
            success: true,
            message: '性能指標已重置'
        });
    } catch (error) {
        logger.error('重置性能指標失敗:', error);
        res.status(500).json({
            success: false,
            error: '重置性能指標失敗'
        });
    }
});

/**
 * 清理監控數據
 */
router.post('/cleanup', async (req, res) => {
    try {
        const monitor = getPerformanceMonitor();
        const alertService = monitor.getAlertService();
        
        alertService.cleanup();
        dashboard.cleanup();
        
        res.json({
            success: true,
            message: '監控數據已清理'
        });
    } catch (error) {
        logger.error('清理監控數據失敗:', error);
        res.status(500).json({
            success: false,
            error: '清理監控數據失敗'
        });
    }
});

/**
 * 緩存統計
 */
router.get('/cache/stats', async (req, res) => {
    try {
        const stats = cacheManager.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('獲取緩存統計失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 緩存清理
 */
router.post('/cache/clear', async (req, res) => {
    try {
        await cacheManager.cleanup();
        res.json({
            success: true,
            message: '緩存清理完成'
        });
    } catch (error) {
        logger.error('緩存清理失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 緩存預熱
 */
router.post('/cache/warmup', async (req, res) => {
    try {
        const { keys } = req.body;
        if (!keys || !Array.isArray(keys)) {
            return res.status(400).json({
                success: false,
                error: '請提供要預熱的緩存鍵數組'
            });
        }

        const results = [];
        for (const key of keys) {
            try {
                const value = await cacheManager.get(key);
                results.push({ key, success: true, cached: !!value });
            } catch (error) {
                results.push({ key, success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        logger.error('緩存預熱失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
