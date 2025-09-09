/**
 * MonitoringDashboard 測試
 */

const MonitoringDashboard = require('../../services/MonitoringDashboard');
const logger = require('../../utils/logger');

// Mock logger
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

describe('MonitoringDashboard', () => {
    let dashboard;

    beforeEach(() => {
        dashboard = new MonitoringDashboard();
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (dashboard.isRunning) {
            dashboard.stop();
        }
    });

    describe('初始化', () => {
        test('應該正確初始化監控儀表板', () => {
            expect(dashboard.metrics).toBeInstanceOf(Map);
            expect(dashboard.charts).toBeInstanceOf(Map);
            expect(dashboard.alerts).toEqual([]);
            expect(dashboard.historicalData).toEqual([]);
            expect(dashboard.isRunning).toBe(false);
        });
    });

    describe('啟動和停止', () => {
        test('應該能夠啟動監控儀表板', () => {
            dashboard.start();
            expect(dashboard.isRunning).toBe(true);
        });

        test('應該能夠停止監控儀表板', () => {
            dashboard.start();
            dashboard.stop();
            expect(dashboard.isRunning).toBe(false);
        });

        test('應該防止重複啟動', () => {
            dashboard.start();
            dashboard.start(); // 第二次啟動應該被忽略
            expect(dashboard.isRunning).toBe(true);
        });
    });

    describe('指標更新', () => {
        test('應該能夠更新指標數據', () => {
            const metrics = {
                performance: {
                    averageResponseTime: 100,
                    successRate: 0.95,
                    memoryUsage: 0.5
                },
                exchanges: {
                    bybit: { connected: true, availableSymbols: 2 },
                    binance: { connected: true, availableSymbols: 2 }
                }
            };

            dashboard.updateMetrics(metrics);

            expect(dashboard.metrics.get('performance')).toEqual(metrics.performance);
            expect(dashboard.metrics.get('exchanges')).toEqual(metrics.exchanges);
        });

        test('應該添加歷史數據', () => {
            const metrics = {
                performance: { averageResponseTime: 100 }
            };

            dashboard.updateMetrics(metrics);
            expect(dashboard.historicalData.length).toBe(1);
        });

        test('應該限制歷史數據大小', () => {
            // 添加超過限制的數據
            for (let i = 0; i < 1500; i++) {
                dashboard.addHistoricalData({
                    timestamp: Date.now() + i,
                    performance: { averageResponseTime: 100 }
                });
            }

            expect(dashboard.historicalData.length).toBeLessThanOrEqual(1000);
        });
    });

    describe('圖表數據生成', () => {
        beforeEach(() => {
            // 添加一些測試數據
            const now = Date.now();
            for (let i = 0; i < 10; i++) {
                dashboard.addHistoricalData({
                    timestamp: now - (10 - i) * 60000, // 每分鐘一個數據點
                    performance: {
                        averageResponseTime: 100 + i * 10,
                        successRate: 0.95 - i * 0.01,
                        memoryUsage: 0.5 + i * 0.05
                    },
                    exchanges: {
                        bybit: { connected: true },
                        binance: { connected: true }
                    },
                    arbitrage: {
                        opportunities: i
                    }
                });
            }
        });

        test('應該生成響應時間圖表數據', () => {
            dashboard.updateChartData();
            const chart = dashboard.charts.get('responseTime');

            expect(chart).toBeDefined();
            expect(chart.title).toBe('響應時間趨勢');
            expect(chart.type).toBe('line');
            expect(chart.data).toBeDefined();
            expect(chart.data.length).toBeGreaterThan(0);
        });

        test('應該生成成功率圖表數據', () => {
            dashboard.updateChartData();
            const chart = dashboard.charts.get('successRate');

            expect(chart).toBeDefined();
            expect(chart.title).toBe('成功率趨勢');
            expect(chart.type).toBe('line');
            expect(chart.data).toBeDefined();
        });

        test('應該生成內存使用圖表數據', () => {
            dashboard.updateChartData();
            const chart = dashboard.charts.get('memoryUsage');

            expect(chart).toBeDefined();
            expect(chart.title).toBe('內存使用率');
            expect(chart.type).toBe('area');
            expect(chart.data).toBeDefined();
        });
    });

    describe('儀表板數據生成', () => {
        test('應該生成完整的儀表板數據', () => {
            const metrics = {
                performance: {
                    averageResponseTime: 100,
                    successRate: 0.95,
                    memoryUsage: 0.5
                },
                exchanges: {
                    bybit: { connected: true, availableSymbols: 2 },
                    binance: { connected: true, availableSymbols: 2 }
                },
                arbitrage: {
                    opportunities: 5,
                    totalTrades: 10,
                    totalProfit: 1000
                }
            };

            dashboard.updateMetrics(metrics);
            const dashboardData = dashboard.generateDashboardData();

            expect(dashboardData).toHaveProperty('timestamp');
            expect(dashboardData).toHaveProperty('performance');
            expect(dashboardData).toHaveProperty('exchanges');
            expect(dashboardData).toHaveProperty('arbitrage');
            expect(dashboardData).toHaveProperty('alerts');
            expect(dashboardData).toHaveProperty('charts');
            expect(dashboardData).toHaveProperty('status');
        });
    });

    describe('告警管理', () => {
        test('應該能夠設置告警', () => {
            const alerts = [
                { id: 'alert1', status: 'active', resolved: false },
                { id: 'alert2', status: 'resolved', resolved: true }
            ];

            dashboard.setAlerts(alerts);
            expect(dashboard.alerts).toEqual(alerts);
        });

        test('應該能夠添加告警', () => {
            const alert = { id: 'alert1', status: 'active', resolved: false };
            dashboard.addAlert(alert);
            expect(dashboard.alerts).toContain(alert);
        });

        test('應該限制告警數量', () => {
            // 添加大量告警
            for (let i = 0; i < 150; i++) {
                dashboard.addAlert({
                    id: `alert_${i}`,
                    status: 'active',
                    resolved: false
                });
            }

            expect(dashboard.alerts.length).toBeLessThanOrEqual(100);
        });
    });

    describe('歷史數據查詢', () => {
        beforeEach(() => {
            const now = Date.now();
            for (let i = 0; i < 100; i++) {
                dashboard.addHistoricalData({
                    timestamp: now - i * 60000, // 每分鐘一個數據點
                    performance: { averageResponseTime: 100 + i }
                });
            }
        });

        test('應該能夠獲取歷史數據', () => {
            const data = dashboard.getHistoricalData('1h');
            expect(data.length).toBeGreaterThan(0);
        });

        test('應該能夠按時間範圍過濾數據', () => {
            const data1h = dashboard.getHistoricalData('1h');
            const data24h = dashboard.getHistoricalData('24h');
            
            expect(data1h.length).toBeLessThanOrEqual(data24h.length);
        });

        test('應該能夠按指標過濾數據', () => {
            const data = dashboard.getHistoricalData('1h', 'performance.averageResponseTime');
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('timestamp');
            expect(data[0]).toHaveProperty('value');
        });
    });

    describe('數據導出', () => {
        beforeEach(() => {
            dashboard.addHistoricalData({
                timestamp: Date.now(),
                performance: { averageResponseTime: 100 },
                exchanges: { bybit: { connected: true } }
            });
        });

        test('應該能夠導出 JSON 數據', () => {
            const data = dashboard.exportData('json', '1h');
            expect(() => JSON.parse(data)).not.toThrow();
        });

        test('應該能夠導出 CSV 數據', () => {
            const data = dashboard.exportData('csv', '1h');
            expect(typeof data).toBe('string');
            expect(data).toContain('timestamp,performance,exchanges,arbitrage,system');
        });
    });

    describe('清理功能', () => {
        test('應該能夠清理舊數據', () => {
            const oldData = {
                timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8天前
                performance: { averageResponseTime: 100 }
            };

            dashboard.addHistoricalData(oldData);
            dashboard.cleanup();

            expect(dashboard.historicalData).not.toContain(oldData);
        });
    });

    describe('服務狀態', () => {
        test('應該提供服務狀態', () => {
            const status = dashboard.getStatus();
            
            expect(status).toHaveProperty('enabled');
            expect(status).toHaveProperty('lastUpdate');
            expect(status).toHaveProperty('dataPoints');
            expect(status).toHaveProperty('activeAlerts');
            expect(status).toHaveProperty('charts');
        });
    });
});
