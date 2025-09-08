/**
 * 簡化版日誌工具
 */

const logger = {
    info: (message, data) => {
        console.log(`[INFO] ${message}`, data || '');
    },
    error: (message, error) => {
        console.error(`[ERROR] ${message}`, error || '');
    },
    warn: (message, data) => {
        console.warn(`[WARN] ${message}`, data || '');
    },
    // 補充常用的業務日誌層級
    trading: (message, data) => {
        console.log(`[TRADING] ${message}`, data || '');
    },
    arbitrage: (message, data) => {
        console.log(`[ARBITRAGE] ${message}`, data || '');
    },
    risk: (message, data) => {
        console.log(`[RISK] ${message}`, data || '');
    },
    debug: (message, data) => {
        console.debug(`[DEBUG] ${message}`, data || '');
    }
};

module.exports = logger;