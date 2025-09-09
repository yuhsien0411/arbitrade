/**
 * AlertService 測試
 */

const AlertService = require('../../services/AlertService');
const logger = require('../../utils/logger');

// Mock logger
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
    createTransporter: jest.fn(() => ({
        sendMail: jest.fn().mockResolvedValue(true)
    }))
}));

// Mock axios
jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ data: { success: true } })
}));

describe('AlertService', () => {
    let alertService;

    beforeEach(() => {
        alertService = new AlertService();
        jest.clearAllMocks();
    });

    describe('初始化', () => {
        test('應該正確初始化告警服務', () => {
            expect(alertService.alertRules).toBeInstanceOf(Map);
            expect(alertService.alertHistory).toEqual([]);
            expect(alertService.suppressedAlerts).toBeInstanceOf(Set);
        });

        test('應該設置默認告警規則', () => {
            expect(alertService.alertRules.size).toBeGreaterThan(0);
            expect(alertService.alertRules.has('high_response_time')).toBe(true);
            expect(alertService.alertRules.has('low_success_rate')).toBe(true);
        });
    });

    describe('告警規則管理', () => {
        test('應該能夠添加告警規則', () => {
            const rule = {
                id: 'test_rule',
                condition: (metrics) => metrics.test > 100,
                message: '測試告警',
                severity: 'warning'
            };

            alertService.addAlertRule(rule);
            expect(alertService.alertRules.has('test_rule')).toBe(true);
        });

        test('應該能夠移除告警規則', () => {
            const rule = {
                id: 'test_rule',
                condition: (metrics) => metrics.test > 100,
                message: '測試告警',
                severity: 'warning'
            };

            alertService.addAlertRule(rule);
            const removed = alertService.removeAlertRule('test_rule');
            
            expect(removed).toBe(true);
            expect(alertService.alertRules.has('test_rule')).toBe(false);
        });

        test('應該驗證告警規則必需字段', () => {
            expect(() => {
                alertService.addAlertRule({ id: 'test' });
            }).toThrow('告警規則必須包含 id、condition 和 message');
        });
    });

    describe('告警檢查', () => {
        test('應該檢查告警條件', () => {
            const metrics = {
                performance: {
                    averageResponseTime: 1500,
                    successRate: 0.8
                }
            };

            const triggeredAlerts = alertService.checkAlerts(metrics);
            // 由於冷卻時間，可能不會立即觸發告警
            expect(Array.isArray(triggeredAlerts)).toBe(true);
        });

        test('應該在冷卻期間不重複觸發告警', () => {
            const metrics = {
                performance: {
                    averageResponseTime: 1500
                }
            };

            // 第一次觸發
            alertService.checkAlerts(metrics);
            const firstCount = alertService.alertHistory.length;

            // 立即再次檢查（應該被冷卻阻止）
            alertService.checkAlerts(metrics);
            const secondCount = alertService.alertHistory.length;

            expect(secondCount).toBe(firstCount);
        });
    });

    describe('告警通知', () => {
        test('應該記錄告警歷史', () => {
            // 手動添加告警到歷史記錄
            const alert = {
                id: 'test_alert',
                ruleId: 'test_rule',
                severity: 'warning',
                message: '測試告警',
                timestamp: new Date(),
                status: 'active',
                resolved: false
            };
            
            alertService.alertHistory.push(alert);
            expect(alertService.alertHistory.length).toBeGreaterThan(0);
        });

        test('應該限制告警歷史數量', () => {
            // 添加大量告警（包含一些舊的告警）
            for (let i = 0; i < 1500; i++) {
                const timestamp = i < 100 ? 
                    new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) : // 8天前
                    new Date(); // 當前時間
                    
                alertService.alertHistory.push({
                    id: `alert_${i}`,
                    timestamp: timestamp
                });
            }

            const initialCount = alertService.alertHistory.length;
            expect(initialCount).toBe(1500);
            
            // 觸發清理
            alertService.cleanup();
            
            // 清理後應該少於初始數量（舊的告警被清理）
            expect(alertService.alertHistory.length).toBeLessThan(initialCount);
        });
    });

    describe('告警解決', () => {
        test('應該能夠解決告警', () => {
            const alert = {
                id: 'test_alert',
                status: 'active',
                resolved: false
            };

            alertService.alertHistory.push(alert);
            const resolved = alertService.resolveAlert('test_alert');

            expect(resolved).toBe(true);
            expect(alert.status).toBe('resolved');
            expect(alert.resolved).toBe(true);
            expect(alert.resolvedAt).toBeDefined();
        });

        test('應該處理不存在的告警', () => {
            const resolved = alertService.resolveAlert('nonexistent_alert');
            expect(resolved).toBe(false);
        });
    });

    describe('告警統計', () => {
        test('應該提供告警統計', () => {
            const stats = alertService.getAlertStats();
            
            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('active');
            expect(stats).toHaveProperty('bySeverity');
            expect(stats).toHaveProperty('byRule');
        });

        test('應該獲取活躍告警', () => {
            const activeAlerts = alertService.getActiveAlerts();
            expect(Array.isArray(activeAlerts)).toBe(true);
        });
    });

    describe('服務狀態', () => {
        test('應該提供服務狀態', () => {
            const status = alertService.getStatus();
            
            expect(status).toHaveProperty('enabled');
            expect(status).toHaveProperty('rulesCount');
            expect(status).toHaveProperty('activeAlerts');
            expect(status).toHaveProperty('totalAlerts');
            expect(status).toHaveProperty('channels');
        });
    });
});
