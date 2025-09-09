/**
 * API路由配置
 * 提供RESTful API接口供前端調用
 * 
 */

const express = require('express');
const router = express.Router();
const { getArbitrageEngine } = require('../services/arbitrageEngine');
const { ArbitragePair, Trade, PriceData } = require('../models');
const ExchangeStatusService = require('../services/ExchangeStatusService');
const monitoringRoutes = require('./monitoring');
const CacheManager = require('../services/CacheManager');
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

// 全局緩存管理器（路由級別）
const apiCache = new CacheManager();
// 應用啟動時初始化（忽略失敗，使用內存緩存）
apiCache.initialize().catch(() => logger.warn('API Cache 使用內存模式'));

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
        
        // 獲取所有交易所狀態
        const allStatuses = ExchangeStatusService.getAllExchangeStatuses();
        
        // 處理每個交易所
        for (const [key, status] of Object.entries(allStatuses)) {
            exchanges[key] = {
                name: status.name,
                connected: status.connected,
                status: status.status,
                implemented: status.implemented,
                message: status.message,
                features: status.features,
                priority: status.priority
            };
            
            // 如果是已連接的交易所，添加交易對信息
            if (status.connected && req.engine.exchanges[key]) {
                try {
                    const exchange = req.engine.exchanges[key];
                    if (exchange.getAvailableSymbols) {
                        exchanges[key].symbols = {
                            spot: exchange.getAvailableSymbols('spot') || [],
                            linear: exchange.getAvailableSymbols('linear') || [],
                            inverse: exchange.getAvailableSymbols('inverse') || []
                        };
                    }
                } catch (error) {
                    logger.warn(`獲取 ${key} 交易對信息失敗:`, error);
                }
            }
        }

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
 * 獲取套利交易對列表
 * GET /api/arbitrage-pairs
 */
router.get('/arbitrage-pairs', async (req, res) => {
    try {
        const pairs = await ArbitragePair.find().sort({ createdAt: -1 });
        
        res.json({
            success: true,
            data: pairs
        });

    } catch (error) {
        logger.error('獲取套利交易對失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 創建新的套利交易對
 * POST /api/arbitrage-pairs
 */
router.post('/arbitrage-pairs', async (req, res) => {
    try {
        const pairData = req.body;
        
        // 驗證必需字段
        const requiredFields = ['id', 'leg1', 'leg2', 'threshold', 'amount'];
        for (const field of requiredFields) {
            if (!pairData[field]) {
                return res.status(400).json({
                    success: false,
                    error: `缺少必需字段: ${field}`
                });
            }
        }
        
        const newPair = new ArbitragePair(pairData);
        await newPair.save();
        
        logger.info(`創建新的套利交易對: ${newPair.id}`);
        
        res.status(201).json({
            success: true,
            data: newPair
        });

    } catch (error) {
        logger.error('創建套利交易對失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 更新套利交易對
 * PUT /api/arbitrage-pairs/:id
 */
router.put('/arbitrage-pairs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updatedPair = await ArbitragePair.findOneAndUpdate(
            { id },
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!updatedPair) {
            return res.status(404).json({
                success: false,
                error: '套利交易對不存在'
            });
        }
        
        logger.info(`更新套利交易對: ${id}`);
        
        res.json({
            success: true,
            data: updatedPair
        });

    } catch (error) {
        logger.error('更新套利交易對失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 刪除套利交易對
 * DELETE /api/arbitrage-pairs/:id
 */
router.delete('/arbitrage-pairs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedPair = await ArbitragePair.findOneAndDelete({ id });
        
        if (!deletedPair) {
            return res.status(404).json({
                success: false,
                error: '套利交易對不存在'
            });
        }
        
        logger.info(`刪除套利交易對: ${id}`);
        
        res.json({
            success: true,
            message: '套利交易對已刪除'
        });

    } catch (error) {
        logger.error('刪除套利交易對失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取交易記錄
 * GET /api/trades
 */
router.get('/trades', async (req, res) => {
    try {
        const { 
            arbitragePairId, 
            status, 
            tradeType, 
            limit = 50, 
            offset = 0 
        } = req.query;
        
        const filter = {};
        if (arbitragePairId) filter.arbitragePairId = arbitragePairId;
        if (status) filter.status = status;
        if (tradeType) filter.tradeType = tradeType;
        
        const trades = await Trade.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
        
        const total = await Trade.countDocuments(filter);
        
        res.json({
            success: true,
            data: {
                trades,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        logger.error('獲取交易記錄失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取價格數據
 * GET /api/price-data
 */
router.get('/price-data', async (req, res) => {
    try {
        const { 
            exchange, 
            symbol, 
            startTime, 
            endTime, 
            limit = 100 
        } = req.query;
        
        if (!exchange || !symbol) {
            return res.status(400).json({
                success: false,
                error: '缺少必需參數: exchange, symbol'
            });
        }
        
        const filter = { exchange, symbol };
        if (startTime && endTime) {
            filter.timestamp = {
                $gte: new Date(startTime),
                $lte: new Date(endTime)
            };
        }
        
        const priceData = await PriceData.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        res.json({
            success: true,
            data: priceData
        });

    } catch (error) {
        logger.error('獲取價格數據失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取交易所狀態統計
 * GET /api/exchanges/stats
 */
router.get('/exchanges/stats', (req, res) => {
    try {
        const stats = ExchangeStatusService.getExchangeStats();
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('獲取交易所統計失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取已實現的交易所列表
 * GET /api/exchanges/implemented
 */
router.get('/exchanges/implemented', (req, res) => {
    try {
        const implemented = ExchangeStatusService.getImplementedExchanges();
        
        res.json({
            success: true,
            data: implemented
        });

    } catch (error) {
        logger.error('獲取已實現交易所失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取計劃中的交易所列表
 * GET /api/exchanges/planned
 */
router.get('/exchanges/planned', (req, res) => {
    try {
        const planned = ExchangeStatusService.getPlannedExchanges();
        
        res.json({
            success: true,
            data: planned
        });

    } catch (error) {
        logger.error('獲取計劃中交易所失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取連接的交易所列表
 * GET /api/exchanges/connected
 */
router.get('/exchanges/connected', (req, res) => {
    try {
        const connected = ExchangeStatusService.getConnectedExchanges();
        
        res.json({
            success: true,
            data: connected
        });

    } catch (error) {
        logger.error('獲取連接交易所失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取推薦的交易所組合
 * GET /api/exchanges/recommended-pairs
 */
router.get('/exchanges/recommended-pairs', (req, res) => {
    try {
        const pairs = ExchangeStatusService.getRecommendedExchangePairs();
        
        res.json({
            success: true,
            data: pairs
        });

    } catch (error) {
        logger.error('獲取推薦交易所組合失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取交易所功能支持
 * GET /api/exchanges/features
 */
router.get('/exchanges/features', (req, res) => {
    try {
        const features = ExchangeStatusService.getExchangeFeatures();
        
        res.json({
            success: true,
            data: features
        });

    } catch (error) {
        logger.error('獲取交易所功能失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 檢查交易所是否支持特定功能
 * GET /api/exchanges/:exchange/features/:feature
 */
router.get('/exchanges/:exchange/features/:feature', (req, res) => {
    try {
        const { exchange, feature } = req.params;
        const supports = ExchangeStatusService.supportsFeature(exchange, feature);
        
        res.json({
            success: true,
            data: {
                exchange,
                feature,
                supports
            }
        });

    } catch (error) {
        logger.error('檢查交易所功能支持失敗:', error);
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
        const cacheKey = apiCache.generateKey(`price:${exchange}:${symbol}`);

        // 先查緩存
        const cached = await apiCache.get(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached, cached: true });
        }
        
        if (exchange === 'bybit') {
            const orderBook = await req.engine.exchanges.bybit.getOrderBook(symbol);
            await apiCache.set(cacheKey, orderBook, 2); // 2秒TTL
            res.json({
                success: true,
                data: orderBook
            });
        } else if (exchange === 'binance' && req.engine.exchanges.binance) {
            const orderBook = await req.engine.exchanges.binance.getOrderBook(symbol, 'spot');
            await apiCache.set(cacheKey, orderBook, 2);
            res.json({
                success: true,
                data: orderBook
            });
        } else {
            return res.status(400).json({
                success: false,
                error: `不支援的交易所: ${exchange}`
            });
        }

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

        // 支持多交易所批量獲取價格
        const prices = {};
        
        // 獲取 Bybit 價格
        try {
            // 批量緩存鍵
            const bybitResults = {};
            for (const s of symbols) {
                const key = apiCache.generateKey(`price:bybit:${s}`);
                const cached = await apiCache.get(key);
                if (cached) {
                    bybitResults[s] = cached;
                } else {
                    const ob = await req.engine.exchanges.bybit.getOrderBook(s);
                    bybitResults[s] = ob;
                    await apiCache.set(key, ob, 2);
                }
            }
            prices.bybit = bybitResults;
        } catch (error) {
            logger.warn('獲取 Bybit 批量價格失敗:', error);
            prices.bybit = {};
        }
        
        // 獲取 Binance 價格
        if (req.engine.exchanges.binance) {
            try {
                const binancePrices = {};
                for (const symbol of symbols) {
                    const key = apiCache.generateKey(`price:binance:${symbol}`);
                    const cached = await apiCache.get(key);
                    if (cached) {
                        binancePrices[symbol] = cached;
                    } else {
                        const orderBook = await req.engine.exchanges.binance.getOrderBook(symbol, 'spot');
                        binancePrices[symbol] = orderBook;
                        await apiCache.set(key, orderBook, 2);
                    }
                }
                prices.binance = binancePrices;
            } catch (error) {
                logger.warn('獲取 Binance 批量價格失敗:', error);
                prices.binance = {};
            }
        }
        
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
        
        if (exchange === 'bybit') {
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
        } else if (exchange === 'binance' && req.engine.exchanges.binance) {
            const [balance, positions] = await Promise.all([
                req.engine.exchanges.binance.getBalance(),
                req.engine.exchanges.binance.getPositions()
            ]);
            
            res.json({
                success: true,
                data: {
                    balance,
                    positions
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                error: `不支援的交易所: ${exchange}`
            });
        }

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

// 監控路由
router.use('/monitoring', monitoringRoutes);

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
