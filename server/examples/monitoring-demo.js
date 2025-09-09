/**
 * 監控系統演示腳本
 * 展示告警服務和監控儀表板的功能
 */

const AlertService = require('../services/AlertService');
const MonitoringDashboard = require('../services/MonitoringDashboard');
const { getPerformanceMonitor } = require('../services/PerformanceMonitor');
const logger = require('../utils/logger');

class MonitoringDemo {
    constructor() {
        this.alertService = new AlertService();
        this.dashboard = new MonitoringDashboard();
        this.performanceMonitor = getPerformanceMonitor();
        
        // 啟動監控服務
        this.performanceMonitor.startMonitoring();
        this.dashboard.start();
    }

    async runDemo() {
        console.log('🚀 開始監控系統演示...\n');

        try {
            // 1. 演示告警服務
            await this.demonstrateAlertService();
            
            // 2. 演示監控儀表板
            await this.demonstrateMonitoringDashboard();
            
            // 3. 演示性能監控
            await this.demonstratePerformanceMonitoring();
            
            // 4. 演示告警規則管理
            await this.demonstrateAlertRuleManagement();
            
            // 5. 演示數據導出
            await this.demonstrateDataExport();
            
            console.log('\n🎉 監控系統演示完成！');
            
        } catch (error) {
            console.error('❌ 演示過程中發生錯誤:', error);
        } finally {
            // 清理資源
            this.performanceMonitor.stopMonitoring();
            this.dashboard.stop();
        }
    }

    async demonstrateAlertService() {
        console.log('📊 演示告警服務...');
        
        // 添加自定義告警規則
        this.alertService.addAlertRule({
            id: 'demo_high_cpu',
            name: '高 CPU 使用率告警',
            condition: (metrics) => metrics.system?.cpuUsage > 0.8,
            severity: 'warning',
            message: 'CPU 使用率過高',
            cooldown: 30000, // 30秒
            channels: ['log']
        });

        // 模擬觸發告警
        const metrics = {
            performance: {
                averageResponseTime: 1500,
                successRate: 0.85,
                memoryUsage: 0.7
            },
            system: {
                cpuUsage: 0.85,
                memoryUsage: 0.6
            },
            exchanges: {
                bybit: { connected: true },
                binance: { connected: false }
            }
        };

        console.log('   🔍 檢查告警條件...');
        const triggeredAlerts = this.alertService.checkAlerts(metrics);
        console.log(`   📈 觸發了 ${triggeredAlerts.length} 個告警`);

        // 顯示告警統計
        const stats = this.alertService.getAlertStats();
        console.log('   📊 告警統計:', {
            總告警數: stats.total,
            活躍告警: stats.active,
            按嚴重程度: stats.bySeverity
        });

        console.log('   ✅ 告警服務演示完成\n');
    }

    async demonstrateMonitoringDashboard() {
        console.log('📈 演示監控儀表板...');
        
        // 模擬一些歷史數據
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            const timestamp = now - (10 - i) * 60000; // 每分鐘一個數據點
            
            this.dashboard.updateMetrics({
                performance: {
                    averageResponseTime: 100 + i * 10,
                    successRate: 0.95 - i * 0.01,
                    memoryUsage: 0.5 + i * 0.05
                },
                exchanges: {
                    bybit: { connected: true, availableSymbols: 2 },
                    binance: { connected: i % 2 === 0, availableSymbols: 2 }
                },
                arbitrage: {
                    opportunities: i,
                    totalTrades: i * 2,
                    totalProfit: i * 100
                }
            });
        }

        // 生成儀表板數據
        const dashboardData = this.dashboard.generateDashboardData();
        console.log('   📊 儀表板數據:', {
            時間戳: new Date(dashboardData.timestamp).toLocaleString(),
            性能指標: dashboardData.performance,
            交易所狀態: Object.keys(dashboardData.exchanges).length,
            圖表數量: Object.keys(dashboardData.charts).length
        });

        // 獲取歷史數據
        const historicalData = this.dashboard.getHistoricalData('1h');
        console.log(`   📈 歷史數據點: ${historicalData.length}`);

        console.log('   ✅ 監控儀表板演示完成\n');
    }

    async demonstratePerformanceMonitoring() {
        console.log('⚡ 演示性能監控...');
        
        // 模擬一些性能事件
        this.performanceMonitor.recordResponseTime('bybit', 150);
        this.performanceMonitor.recordResponseTime('binance', 200);
        this.performanceMonitor.recordSuccess('bybit', true);
        this.performanceMonitor.recordSuccess('binance', false);
        this.performanceMonitor.updateConnectionStatus('bybit', true);
        this.performanceMonitor.updateConnectionStatus('binance', false);

        // 獲取性能指標
        const metrics = this.performanceMonitor.getMetrics();
        console.log('   📊 性能指標:', {
            響應時間: metrics.responseTimes,
            成功率: metrics.successRates,
            連接狀態: metrics.connectionStatus
        });

        // 獲取性能報告
        const report = this.performanceMonitor.getPerformanceReport();
        console.log('   📋 性能報告:', {
            總套利機會: report.summary.totalOpportunities,
            執行率: (report.summary.executionRate * 100).toFixed(2) + '%',
            總利潤: report.summary.totalProfit
        });

        console.log('   ✅ 性能監控演示完成\n');
    }

    async demonstrateAlertRuleManagement() {
        console.log('🔧 演示告警規則管理...');
        
        // 添加自定義規則
        const customRule = {
            id: 'demo_custom_rule',
            name: '自定義告警規則',
            condition: (metrics) => metrics.performance?.averageResponseTime > 2000,
            severity: 'critical',
            message: '響應時間過長',
            cooldown: 60000,
            channels: ['log', 'email']
        };

        this.alertService.addAlertRule(customRule);
        console.log('   ➕ 已添加自定義告警規則');

        // 列出所有規則
        const rules = Array.from(this.alertService.alertRules.keys());
        console.log(`   📋 當前告警規則數量: ${rules.length}`);

        // 移除規則
        const removed = this.alertService.removeAlertRule('demo_custom_rule');
        console.log(`   ➖ 移除規則結果: ${removed ? '成功' : '失敗'}`);

        console.log('   ✅ 告警規則管理演示完成\n');
    }

    async demonstrateDataExport() {
        console.log('📤 演示數據導出...');
        
        // 導出 JSON 數據
        const jsonData = this.dashboard.exportData('json', '1h');
        console.log(`   📄 JSON 數據大小: ${jsonData.length} 字符`);

        // 導出 CSV 數據
        const csvData = this.dashboard.exportData('csv', '1h');
        console.log(`   📊 CSV 數據行數: ${csvData.split('\n').length}`);

        // 獲取特定指標的歷史數據
        const responseTimeData = this.dashboard.getHistoricalData('1h', 'performance.averageResponseTime');
        console.log(`   ⏱️ 響應時間數據點: ${responseTimeData.length}`);

        console.log('   ✅ 數據導出演示完成\n');
    }
}

// 運行演示
if (require.main === module) {
    const demo = new MonitoringDemo();
    demo.runDemo().catch(console.error);
}

module.exports = MonitoringDemo;
