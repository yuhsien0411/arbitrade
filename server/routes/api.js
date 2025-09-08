/**
 * API路由配置
 * 提供RESTful API接口供前端調用
 * 
 */

const express = require('express');
const router = express.Router();
const { getArbitrageEngine } = require('../services/arbitrageEngine');
const logger = require('../utils/logger');

// 中間件：檢查引擎狀態
const requireEngine = (req, res, next) => {
    const engine = getArbitrageEngine();
    if (!engine) {
        return res.status(503).json({
            error: '套利引擎未啟動',
            message: '請稍後重試'
        });
    }
    req.engine = engine;
    next();
};

// 中間件：請求日誌
router.use((req, res, next) => {
    logger.info(`API請求: ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

/**
 * 獲取系統狀態
 * GET /api/status
 */
router.get('/status', requireEngine, (req, res) => {
    try {
        const status = req.engine.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error('獲取系統狀態失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取可用的交易所和交易對
 * GET /api/exchanges
 */
router.get('/exchanges', requireEngine, async (req, res) => {
    try {
        const exchanges = {};
        
        // Bybit交易對
        if (req.engine.exchanges.bybit.isExchangeConnected()) {
            exchanges.bybit = {
                name: 'Bybit',
                connected: true,
                symbols: {
                    future: req.engine.exchanges.bybit.getAvailableSymbols('future'),
                    spot: req.engine.exchanges.bybit.getAvailableSymbols('spot')
                }
            };
        }

        // 未來可以添加其他交易所
        exchanges.binance = { name: 'Binance', connected: false, comingSoon: true };
        exchanges.okx = { name: 'OKX', connected: false, comingSoon: true };
        exchanges.bitget = { name: 'Bitget', connected: false, comingSoon: true };

        res.json({
            success: true,
            data: exchanges
        });

    } catch (error) {
        logger.error('獲取交易所信息失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取即時價格數據
 * GET /api/prices/:exchange/:symbol
 */
router.get('/prices/:exchange/:symbol', requireEngine, async (req, res) => {
    try {
        const { exchange, symbol } = req.params;
        
        if (exchange !== 'bybit') {
            return res.status(400).json({
                success: false,
                error: '目前只支援Bybit交易所'
            });
        }

        const orderBook = await req.engine.exchanges.bybit.getOrderBook(symbol);
        
        res.json({
            success: true,
            data: orderBook
        });

    } catch (error) {
        logger.error(`獲取價格數據失敗 ${req.params.exchange}/${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 批量獲取價格數據
 * POST /api/prices/batch
 * Body: { symbols: ['BTCUSDT', 'ETHUSDT'] }
 */
router.post('/prices/batch', requireEngine, async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({
                success: false,
                error: '請提供有效的交易對列表'
            });
        }

        const prices = await req.engine.exchanges.bybit.getBatchOrderBooks(symbols);
        
        res.json({
            success: true,
            data: prices
        });

    } catch (error) {
        logger.error('批量獲取價格失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 添加監控交易對
 * POST /api/monitoring/pairs
 */
router.post('/monitoring/pairs', requireEngine, (req, res) => {
    try {
        const config = req.body;
        
        // 基本驗證
        if (!config.leg1 || !config.leg2 || !config.threshold || !config.amount) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數: leg1, leg2, threshold, amount'
            });
        }

        // 生成唯一ID
        config.id = config.id || `pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const pair = req.engine.addMonitoringPair(config);
        
        res.json({
            success: true,
            data: pair
        });

    } catch (error) {
        logger.error('添加監控交易對失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取監控交易對列表
 * GET /api/monitoring/pairs
 */
router.get('/monitoring/pairs', requireEngine, (req, res) => {
    try {
        const pairs = Array.from(req.engine.monitoringPairs.values());
        
        res.json({
            success: true,
            data: pairs
        });

    } catch (error) {
        logger.error('獲取監控交易對失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 更新監控交易對
 * PUT /api/monitoring/pairs/:id
 */
router.put('/monitoring/pairs/:id', requireEngine, (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updatedPair = req.engine.updateMonitoringPair(id, updates);
        
        res.json({
            success: true,
            data: updatedPair
        });

    } catch (error) {
        logger.error(`更新監控交易對失敗 ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 刪除監控交易對
 * DELETE /api/monitoring/pairs/:id
 */
router.delete('/monitoring/pairs/:id', requireEngine, (req, res) => {
    try {
        const { id } = req.params;
        
        const removed = req.engine.removeMonitoringPair(id);
        
        if (removed) {
            res.json({
                success: true,
                message: '監控交易對已刪除'
            });
        } else {
            res.status(404).json({
                success: false,
                error: '未找到指定的監控交易對'
            });
        }

    } catch (error) {
        logger.error(`刪除監控交易對失敗 ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 手動執行套利
 * POST /api/arbitrage/execute/:pairId
 */
router.post('/arbitrage/execute/:pairId', requireEngine, async (req, res) => {
    try {
        const { pairId } = req.params;
        
        const pairConfig = req.engine.monitoringPairs.get(pairId);
        if (!pairConfig) {
            return res.status(404).json({
                success: false,
                error: '未找到指定的交易對配置'
            });
        }

        // 分析當前價差
        const opportunity = await req.engine.analyzePairSpread(pairConfig);
        if (!opportunity) {
            return res.status(400).json({
                success: false,
                error: '當前沒有套利機會或價格數據不可用'
            });
        }

        // 執行套利
        const result = await req.engine.executeArbitrage(opportunity);
        
        res.json({
            success: result.success,
            data: result
        });

    } catch (error) {
        logger.error(`手動執行套利失敗 ${req.params.pairId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 添加TWAP策略
 * POST /api/twap/strategies
 */
router.post('/twap/strategies', requireEngine, (req, res) => {
    try {
        const config = req.body;
        
        // 基本驗證
        if (!config.symbol || !config.side || !config.totalAmount || !config.timeInterval || !config.orderCount) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數: symbol, side, totalAmount, timeInterval, orderCount'
            });
        }

        // 生成唯一ID
        config.id = config.id || `twap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const strategy = req.engine.addTwapStrategy(config);
        
        res.json({
            success: true,
            data: strategy
        });

    } catch (error) {
        logger.error('添加TWAP策略失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取TWAP策略列表
 * GET /api/twap/strategies
 */
router.get('/twap/strategies', requireEngine, (req, res) => {
    try {
        const strategies = Array.from(req.engine.twapStrategies.values());
        
        res.json({
            success: true,
            data: strategies
        });

    } catch (error) {
        logger.error('獲取TWAP策略失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取賬戶信息
 * GET /api/account/:exchange
 */
router.get('/account/:exchange', requireEngine, async (req, res) => {
    try {
        const { exchange } = req.params;
        
        if (exchange !== 'bybit') {
            return res.status(400).json({
                success: false,
                error: '目前只支援Bybit交易所'
            });
        }

        const [balance, positions] = await Promise.all([
            req.engine.exchanges.bybit.getBalance(),
            req.engine.exchanges.bybit.getPositions()
        ]);
        
        res.json({
            success: true,
            data: {
                balance,
                positions
            }
        });

    } catch (error) {
        logger.error(`獲取賬戶信息失敗 ${req.params.exchange}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 更新風險控制設定
 * PUT /api/settings/risk
 */
router.put('/settings/risk', requireEngine, (req, res) => {
    try {
        const { maxPositionSize, maxDailyLoss, priceDeviationThreshold } = req.body;
        
        if (maxPositionSize !== undefined) {
            req.engine.riskLimits.maxPositionSize = parseFloat(maxPositionSize);
        }
        if (maxDailyLoss !== undefined) {
            req.engine.riskLimits.maxDailyLoss = parseFloat(maxDailyLoss);
        }
        if (priceDeviationThreshold !== undefined) {
            req.engine.riskLimits.priceDeviationThreshold = parseFloat(priceDeviationThreshold);
        }

        logger.info('風險控制設定已更新', req.engine.riskLimits);
        
        res.json({
            success: true,
            data: req.engine.riskLimits
        });

    } catch (error) {
        logger.error('更新風險控制設定失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取交易統計
 * GET /api/stats
 */
router.get('/stats', requireEngine, (req, res) => {
    try {
        const stats = req.engine.stats;
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('獲取交易統計失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 錯誤處理中間件
router.use((error, req, res, next) => {
    logger.error('API路由錯誤:', error);
    res.status(500).json({
        success: false,
        error: '內部服務器錯誤',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

module.exports = router;
