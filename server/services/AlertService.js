/**
 * 告警服務
 * 統一管理系統告警和通知
 */

const logger = require('../utils/logger');
const nodemailer = require('nodemailer');
const axios = require('axios');

class AlertService {
    constructor() {
        this.alertRules = new Map();
        this.alertHistory = [];
        this.suppressedAlerts = new Set();
        this.alertCooldowns = new Map();
        this.notificationChannels = new Map();
        
        // 初始化通知渠道
        this.initializeNotificationChannels();
        
        // 設置默認告警規則
        this.setupDefaultAlertRules();
    }

    /**
     * 初始化通知渠道
     */
    initializeNotificationChannels() {
        // 郵件通知配置
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            this.notificationChannels.set('email', {
                transporter: nodemailer.createTransporter({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                }),
                enabled: true
            });
        }

        // Webhook 通知配置
        if (process.env.WEBHOOK_URL) {
            this.notificationChannels.set('webhook', {
                url: process.env.WEBHOOK_URL,
                enabled: true
            });
        }

        // 日誌通知（始終啟用）
        this.notificationChannels.set('log', {
            enabled: true
        });
    }

    /**
     * 設置默認告警規則
     */
    setupDefaultAlertRules() {
        const defaultRules = [
            {
                id: 'high_response_time',
                name: '高響應時間告警',
                condition: (metrics) => metrics.averageResponseTime > 1000,
                severity: 'warning',
                message: '系統響應時間過高',
                cooldown: 300000, // 5分鐘
                channels: ['log', 'email']
            },
            {
                id: 'low_success_rate',
                name: '低成功率告警',
                condition: (metrics) => metrics.successRate < 0.95,
                severity: 'critical',
                message: '系統成功率過低',
                cooldown: 600000, // 10分鐘
                channels: ['log', 'email', 'webhook']
            },
            {
                id: 'high_memory_usage',
                name: '高內存使用告警',
                condition: (metrics) => metrics.memoryUsage > 0.8,
                severity: 'warning',
                message: '系統內存使用率過高',
                cooldown: 300000, // 5分鐘
                channels: ['log', 'email']
            },
            {
                id: 'exchange_disconnected',
                name: '交易所斷線告警',
                condition: (metrics) => {
                    return Object.values(metrics.exchanges || {}).some(exchange => 
                        exchange.connected === false
                    );
                },
                severity: 'critical',
                message: '交易所連接中斷',
                cooldown: 60000, // 1分鐘
                channels: ['log', 'email', 'webhook']
            },
            {
                id: 'arbitrage_opportunity',
                name: '套利機會告警',
                condition: (metrics) => {
                    return metrics.arbitrage && metrics.arbitrage.opportunities > 0;
                },
                severity: 'info',
                message: '發現套利機會',
                cooldown: 30000, // 30秒
                channels: ['log']
            }
        ];

        defaultRules.forEach(rule => this.addAlertRule(rule));
    }

    /**
     * 添加告警規則
     */
    addAlertRule(rule) {
        if (!rule.id || !rule.condition || !rule.message) {
            throw new Error('告警規則必須包含 id、condition 和 message');
        }

        const alertRule = {
            id: rule.id,
            name: rule.name || rule.id,
            condition: rule.condition,
            severity: rule.severity || 'info',
            message: rule.message,
            cooldown: rule.cooldown || 60000, // 默認1分鐘冷卻
            channels: rule.channels || ['log'],
            enabled: rule.enabled !== false,
            ...rule
        };

        this.alertRules.set(rule.id, alertRule);
        logger.info(`告警規則已添加: ${rule.id}`);
    }

    /**
     * 移除告警規則
     */
    removeAlertRule(ruleId) {
        if (this.alertRules.has(ruleId)) {
            this.alertRules.delete(ruleId);
            logger.info(`告警規則已移除: ${ruleId}`);
            return true;
        }
        return false;
    }

    /**
     * 檢查告警條件
     */
    checkAlerts(metrics) {
        const triggeredAlerts = [];

        for (const [ruleId, rule] of this.alertRules) {
            if (!rule.enabled) continue;

            try {
                if (this.shouldTriggerAlert(rule, metrics)) {
                    const alert = this.createAlert(rule, metrics);
                    triggeredAlerts.push(alert);
                    this.triggerAlert(alert);
                }
            } catch (error) {
                logger.error(`檢查告警規則失敗: ${ruleId}`, error);
            }
        }

        return triggeredAlerts;
    }

    /**
     * 判斷是否應該觸發告警
     */
    shouldTriggerAlert(rule, metrics) {
        // 檢查冷卻時間
        const lastTriggered = this.alertCooldowns.get(rule.id);
        if (lastTriggered && Date.now() - lastTriggered < rule.cooldown) {
            return false;
        }

        // 檢查告警條件
        return rule.condition(metrics);
    }

    /**
     * 創建告警對象
     */
    createAlert(rule, metrics) {
        return {
            id: `${rule.id}_${Date.now()}`,
            ruleId: rule.id,
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            metrics: this.sanitizeMetrics(metrics),
            timestamp: new Date(),
            status: 'active',
            resolved: false
        };
    }

    /**
     * 觸發告警
     */
    async triggerAlert(alert) {
        try {
            // 更新冷卻時間
            this.alertCooldowns.set(alert.ruleId, Date.now());

            // 記錄告警歷史
            this.alertHistory.push(alert);
            
            // 限制歷史記錄數量
            if (this.alertHistory.length > 1000) {
                this.alertHistory = this.alertHistory.slice(-500);
            }

            // 發送通知
            await this.sendNotification(alert);

            logger.warn(`告警已觸發: ${alert.name}`, {
                severity: alert.severity,
                message: alert.message,
                metrics: alert.metrics
            });

        } catch (error) {
            logger.error(`觸發告警失敗: ${alert.id}`, error);
        }
    }

    /**
     * 發送通知
     */
    async sendNotification(alert) {
        const rule = this.alertRules.get(alert.ruleId);
        if (!rule) return;

        const promises = [];

        for (const channel of rule.channels) {
            const channelConfig = this.notificationChannels.get(channel);
            if (!channelConfig || !channelConfig.enabled) continue;

            switch (channel) {
                case 'email':
                    promises.push(this.sendEmail(alert, channelConfig));
                    break;
                case 'webhook':
                    promises.push(this.sendWebhook(alert, channelConfig));
                    break;
                case 'log':
                    promises.push(this.sendLog(alert));
                    break;
            }
        }

        await Promise.allSettled(promises);
    }

    /**
     * 發送郵件通知
     */
    async sendEmail(alert, channelConfig) {
        try {
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: process.env.ALERT_EMAIL || process.env.SMTP_USER,
                subject: `[${alert.severity.toUpperCase()}] ${alert.name}`,
                html: this.generateEmailTemplate(alert)
            };

            await channelConfig.transporter.sendMail(mailOptions);
            logger.info(`郵件告警已發送: ${alert.id}`);
        } catch (error) {
            logger.error(`發送郵件告警失敗: ${alert.id}`, error);
        }
    }

    /**
     * 發送 Webhook 通知
     */
    async sendWebhook(alert, channelConfig) {
        try {
            const payload = {
                alert: {
                    id: alert.id,
                    name: alert.name,
                    severity: alert.severity,
                    message: alert.message,
                    timestamp: alert.timestamp.toISOString()
                },
                metrics: alert.metrics
            };

            await axios.post(channelConfig.url, payload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`Webhook 告警已發送: ${alert.id}`);
        } catch (error) {
            logger.error(`發送 Webhook 告警失敗: ${alert.id}`, error);
        }
    }

    /**
     * 發送日誌通知
     */
    async sendLog(alert) {
        const logLevel = this.getLogLevel(alert.severity);
        logger[logLevel](`[ALERT] ${alert.name}: ${alert.message}`, {
            alertId: alert.id,
            severity: alert.severity,
            metrics: alert.metrics
        });
    }

    /**
     * 生成郵件模板
     */
    generateEmailTemplate(alert) {
        const severityColors = {
            info: '#17a2b8',
            warning: '#ffc107',
            critical: '#dc3545',
            error: '#dc3545'
        };

        const color = severityColors[alert.severity] || '#6c757d';

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: ${color}; color: white; padding: 20px; text-align: center;">
                    <h2>🚨 系統告警</h2>
                </div>
                <div style="padding: 20px; background-color: #f8f9fa;">
                    <h3>${alert.name}</h3>
                    <p><strong>嚴重程度:</strong> ${alert.severity.toUpperCase()}</p>
                    <p><strong>時間:</strong> ${alert.timestamp.toLocaleString()}</p>
                    <p><strong>消息:</strong> ${alert.message}</p>
                    
                    <h4>系統指標:</h4>
                    <pre style="background-color: #e9ecef; padding: 10px; border-radius: 4px;">
${JSON.stringify(alert.metrics, null, 2)}
                    </pre>
                </div>
                <div style="background-color: #6c757d; color: white; padding: 10px; text-align: center; font-size: 12px;">
                    此郵件由套利交易系統自動發送
                </div>
            </div>
        `;
    }

    /**
     * 獲取日誌級別
     */
    getLogLevel(severity) {
        const levelMap = {
            info: 'info',
            warning: 'warn',
            critical: 'error',
            error: 'error'
        };
        return levelMap[severity] || 'info';
    }

    /**
     * 清理指標數據
     */
    sanitizeMetrics(metrics) {
        const sanitized = { ...metrics };
        
        // 移除敏感信息
        if (sanitized.exchanges) {
            Object.keys(sanitized.exchanges).forEach(exchange => {
                if (sanitized.exchanges[exchange].apiKey) {
                    sanitized.exchanges[exchange].apiKey = '***';
                }
            });
        }

        return sanitized;
    }

    /**
     * 解決告警
     */
    resolveAlert(alertId) {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.status = 'resolved';
            alert.resolved = true;
            alert.resolvedAt = new Date();
            logger.info(`告警已解決: ${alertId}`);
            return true;
        }
        return false;
    }

    /**
     * 獲取告警歷史
     */
    getAlertHistory(limit = 100, severity = null) {
        let history = this.alertHistory;

        if (severity) {
            history = history.filter(alert => alert.severity === severity);
        }

        return history
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * 獲取活躍告警
     */
    getActiveAlerts() {
        return this.alertHistory.filter(alert => 
            alert.status === 'active' && !alert.resolved
        );
    }

    /**
     * 獲取告警統計
     */
    getAlertStats() {
        const stats = {
            total: this.alertHistory.length,
            active: this.getActiveAlerts().length,
            bySeverity: {},
            byRule: {}
        };

        // 按嚴重程度統計
        this.alertHistory.forEach(alert => {
            stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
            stats.byRule[alert.ruleId] = (stats.byRule[alert.ruleId] || 0) + 1;
        });

        return stats;
    }

    /**
     * 清理過期告警
     */
    cleanup() {
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前
        
        this.alertHistory = this.alertHistory.filter(alert => 
            alert.timestamp.getTime() > cutoffTime
        );

        // 清理過期的冷卻時間
        for (const [ruleId, timestamp] of this.alertCooldowns) {
            if (Date.now() - timestamp > 24 * 60 * 60 * 1000) { // 24小時
                this.alertCooldowns.delete(ruleId);
            }
        }

        logger.info('告警歷史清理完成');
    }

    /**
     * 獲取服務狀態
     */
    getStatus() {
        return {
            enabled: true,
            rulesCount: this.alertRules.size,
            activeAlerts: this.getActiveAlerts().length,
            totalAlerts: this.alertHistory.length,
            channels: Array.from(this.notificationChannels.keys()),
            stats: this.getAlertStats()
        };
    }
}

module.exports = AlertService;
