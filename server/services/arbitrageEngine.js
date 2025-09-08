/**
 * 套利引擎核心服務
 * 
 * 核心功能：
 * - 即時價差監控
 * - 自動套利機會檢測
 * - 雙腿下單執行
 * - TWAP策略執行
 * - 風險控制
 */

const BybitService = require('./bybitService');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class ArbitrageEngine extends EventEmitter {
    constructor() {
        super();
        
        // 交易所服務實例
        this.exchanges = {
            bybit: new BybitService()
        };

        // 監控配置
        this.monitoringPairs = new Map(); // 監控的交易對配置
        this.activeStrategies = new Map(); // 活躍的套利策略
        this.twapStrategies = new Map(); // TWAP策略
        
        // 系統狀態
        this.isRunning = false;
        this.monitoringInterval = null;
        this.priceUpdateInterval = 1000; // 1秒更新一次價格
        
        // 風險控制參數
        this.riskLimits = {
            maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 10000,
            maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 1000,
            priceDeviationThreshold: parseFloat(process.env.PRICE_DEVIATION_THRESHOLD) || 0.05
        };

        // 績效統計
        this.stats = {
            totalTrades: 0,
            successfulTrades: 0,
            totalProfit: 0,
            todayProfit: 0,
            lastResetDate: new Date().toDateString()
        };
    }

    /**
     * 啟動套利引擎
     */
    async start() {
        try {
            logger.info('正在啟動套利引擎...');

            // 初始化Bybit連接
            await this.exchanges.bybit.initialize();
            
            // 開始價格監控
            this.startPriceMonitoring();
            
            this.isRunning = true;
            logger.info('✅ 套利引擎啟動成功');

            // 發送啟動事件
            this.emit('engineStarted');

        } catch (error) {
            logger.error('套利引擎啟動失敗:', error);
            throw error;
        }
    }

    /**
     * 停止套利引擎
     */
    async stop() {
        try {
            logger.info('正在停止套利引擎...');

            this.isRunning = false;
            
            // 停止價格監控
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }

            // 清理交易所連接
            await this.exchanges.bybit.cleanup();

            logger.info('✅ 套利引擎已停止');
            this.emit('engineStopped');

        } catch (error) {
            logger.error('套利引擎停止失敗:', error);
        }
    }

    /**
     * 添加監控交易對
     * 用戶可以選擇要監控的雙腿交易對
     */
    addMonitoringPair(config) {
        const {
            id,
            leg1, 
            leg2, 
            threshold, // 觸發套利的價差閾值
            amount, // 交易數量
            enabled = true
        } = config;

        const pairConfig = {
            id,
            leg1,
            leg2,
            threshold: parseFloat(threshold),
            amount: parseFloat(amount),
            enabled,
            createdAt: Date.now(),
            lastTriggered: null,
            totalTriggers: 0
        };

        this.monitoringPairs.set(id, pairConfig);
        
        logger.info('添加監控交易對', pairConfig);
        this.emit('pairAdded', pairConfig);

        // 自動訂閱 Bybit tickers（若為 Bybit 交易對）
        try {
            const items = [];
            if (pairConfig.leg1?.exchange === 'bybit') items.push({ symbol: pairConfig.leg1.symbol, category: (pairConfig.leg1.type === 'spot' ? 'spot' : 'linear') });
            if (pairConfig.leg2?.exchange === 'bybit') items.push({ symbol: pairConfig.leg2.symbol, category: (pairConfig.leg2.type === 'spot' ? 'spot' : 'linear') });
            if (items.length > 0) {
                this.exchanges.bybit.subscribeToTickers(items);
            }
        } catch (e) {
            logger.error('訂閱 tickers 失敗於 addMonitoringPair:', e);
        }

        return pairConfig;
    }

    /**
     * 移除監控交易對
     */
    removeMonitoringPair(id) {
        const removed = this.monitoringPairs.delete(id);
        if (removed) {
            logger.info(`移除監控交易對: ${id}`);
            this.emit('pairRemoved', { id });
        }
        return removed;
    }

    /**
     * 更新監控交易對配置
     */
    updateMonitoringPair(id, updates) {
        const pair = this.monitoringPairs.get(id);
        if (!pair) {
            throw new Error(`未找到交易對配置: ${id}`);
        }

        const updated = { ...pair, ...updates, updatedAt: Date.now() };
        this.monitoringPairs.set(id, updated);
        
        logger.info(`更新監控交易對 ${id}`, updates);
        this.emit('pairUpdated', updated);

        return updated;
    }

    /**
     * 開始價格監控
     * 核心功能：持續監控bid1/ask1價差
     */
    startPriceMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.checkArbitrageOpportunities();
            } catch (error) {
                logger.error('價格監控過程中發生錯誤:', error);
            }
        }, this.priceUpdateInterval);

        logger.info(`價格監控已啟動，更新間隔: ${this.priceUpdateInterval}ms`);
    }

    /**
     * 檢查套利機會
     * 分析所有監控的交易對，尋找符合條件的套利機會
     */
    async checkArbitrageOpportunities() {
        const opportunities = [];

        for (const [id, pairConfig] of this.monitoringPairs) {
            if (!pairConfig.enabled) continue;

            try {
                const opportunity = await this.analyzePairSpread(pairConfig);
                if (opportunity) {
                    opportunities.push(opportunity);
                }
            } catch (error) {
                logger.error(`分析交易對 ${id} 時發生錯誤:`, error);
            }
        }

        // 如果發現套利機會，發送事件
        if (opportunities.length > 0) {
            this.emit('opportunitiesFound', opportunities);
            
            // 自動執行符合條件的套利
            for (const opportunity of opportunities) {
                if (opportunity.autoExecute) {
                    await this.executeArbitrage(opportunity);
                }
            }
        }
    }

    /**
     * 分析單個交易對的價差
     */
    async analyzePairSpread(pairConfig) {
        const { id, leg1, leg2, threshold, amount } = pairConfig;

        try {
            // 目前只支援Bybit，後續可擴展其他交易所
            let leg1Price, leg2Price;

            // 優先使用 WebSocket tickers 的頂部報價快取；若無，降級至 REST
            if (leg1.exchange === 'bybit') {
                leg1Price = this.exchanges.bybit.getTopOfBook(leg1.symbol) || null;
                if (!leg1Price) {
                    const category1 = (leg1.type === 'spot') ? 'spot' : 'linear';
                    const res1 = await this.exchanges.bybit.getOrderBook(leg1.symbol, category1);
                    if (res1 && res1.success && res1.data) {
                        const raw1 = res1.data;
                        const bids1 = Array.isArray(raw1?.b) ? raw1.b : (Array.isArray(raw1?.list?.[0]?.b) ? raw1.list[0].b : (Array.isArray(raw1?.bids) ? raw1.bids : []));
                        const asks1 = Array.isArray(raw1?.a) ? raw1.a : (Array.isArray(raw1?.list?.[0]?.a) ? raw1.list[0].a : (Array.isArray(raw1?.asks) ? raw1.asks : []));
                        const bestBid = Array.isArray(bids1) && bids1.length > 0 ? bids1[0] : null;
                        const bestAsk = Array.isArray(asks1) && asks1.length > 0 ? asks1[0] : null;
                        leg1Price = {
                            symbol: leg1.symbol,
                            exchange: 'bybit',
                            bid1: Array.isArray(bestBid) && bestBid.length >= 2 ? { price: Number(bestBid[0]), amount: Number(bestBid[1]) } : null,
                            ask1: Array.isArray(bestAsk) && bestAsk.length >= 2 ? { price: Number(bestAsk[0]), amount: Number(bestAsk[1]) } : null
                        };
                    }
                }
            }

            if (leg2.exchange === 'bybit') {
                leg2Price = this.exchanges.bybit.getTopOfBook(leg2.symbol) || null;
                if (!leg2Price) {
                    const category2 = (leg2.type === 'spot') ? 'spot' : 'linear';
                    const res2 = await this.exchanges.bybit.getOrderBook(leg2.symbol, category2);
                    if (res2 && res2.success && res2.data) {
                        const raw2 = res2.data;
                        const bids2 = Array.isArray(raw2?.b) ? raw2.b : (Array.isArray(raw2?.list?.[0]?.b) ? raw2.list[0].b : (Array.isArray(raw2?.bids) ? raw2.bids : []));
                        const asks2 = Array.isArray(raw2?.a) ? raw2.a : (Array.isArray(raw2?.list?.[0]?.a) ? raw2.list[0].a : (Array.isArray(raw2?.asks) ? raw2.asks : []));
                        const bestBid2 = Array.isArray(bids2) && bids2.length > 0 ? bids2[0] : null;
                        const bestAsk2 = Array.isArray(asks2) && asks2.length > 0 ? asks2[0] : null;
                        leg2Price = {
                            symbol: leg2.symbol,
                            exchange: 'bybit',
                            bid1: Array.isArray(bestBid2) && bestBid2.length >= 2 ? { price: Number(bestBid2[0]), amount: Number(bestBid2[1]) } : null,
                            ask1: Array.isArray(bestAsk2) && bestAsk2.length >= 2 ? { price: Number(bestAsk2[0]), amount: Number(bestAsk2[1]) } : null
                        };
                    }
                }
            }

            if (!leg1Price || !leg2Price || !leg1Price.bid1 || !leg2Price.ask1) {
                return null;
            }

            // 計算價差 (leg1 bid1 - leg2 ask1)
            const spread = leg1Price.bid1.price - leg2Price.ask1.price;
            const spreadPercent = (spread / leg2Price.ask1.price) * 100;

            // 檢查是否達到觸發閾值
            const shouldTrigger = Math.abs(spreadPercent) >= threshold;

            const opportunity = {
                id,
                pairConfig,
                leg1Price,
                leg2Price,
                spread,
                spreadPercent,
                threshold,
                shouldTrigger,
                autoExecute: shouldTrigger, // 可以根據用戶設置決定是否自動執行
                timestamp: Date.now(),
                direction: spread > 0 ? 'leg1_sell_leg2_buy' : 'leg1_buy_leg2_sell'
            };

            // 發送價格更新事件
            this.emit('priceUpdate', opportunity);

            return shouldTrigger ? opportunity : null;

        } catch (error) {
            logger.error(`分析交易對 ${id} 價差失敗:`, error);
            return null;
        }
    }

    /**
     * 執行套利交易
     * 核心功能：執行雙腿下單
     */
    async executeArbitrage(opportunity) {
        const { id, pairConfig, direction, leg1Price, leg2Price } = opportunity;

        try {
            logger.arbitrage('開始執行套利交易', {
                pairId: id,
                direction,
                spread: opportunity.spread,
                spreadPercent: opportunity.spreadPercent
            });

            // 風險檢查
            const riskCheck = this.performRiskCheck(pairConfig.amount);
            if (!riskCheck.passed) {
                logger.risk('套利交易被風控阻止', riskCheck);
                return { success: false, reason: riskCheck.reason };
            }

            // 準備雙腿訂單
            let leg1Order, leg2Order;

            if (direction === 'leg1_sell_leg2_buy') {
                // 在leg1賣出，在leg2買入
                leg1Order = {
                    symbol: pairConfig.leg1.symbol,
                    side: 'sell',
                    amount: pairConfig.amount,
                    type: 'market'
                };
                leg2Order = {
                    symbol: pairConfig.leg2.symbol,
                    side: 'buy',
                    amount: pairConfig.amount,
                    type: 'market'
                };
            } else {
                // 在leg1買入，在leg2賣出
                leg1Order = {
                    symbol: pairConfig.leg1.symbol,
                    side: 'buy',
                    amount: pairConfig.amount,
                    type: 'market'
                };
                leg2Order = {
                    symbol: pairConfig.leg2.symbol,
                    side: 'sell',
                    amount: pairConfig.amount,
                    type: 'market'
                };
            }

            // 執行雙腿下單
            const result = await this.exchanges.bybit.executeDualLegOrder(leg1Order, leg2Order);

            // 更新統計數據
            this.updateStats(result, opportunity);

            // 更新交易對觸發記錄
            const updatedPair = this.monitoringPairs.get(id);
            if (updatedPair) {
                updatedPair.lastTriggered = Date.now();
                updatedPair.totalTriggers += 1;
                this.monitoringPairs.set(id, updatedPair);
            }

            // 發送執行完成事件
            this.emit('arbitrageExecuted', {
                opportunity,
                result,
                success: true
            });

            return { success: true, result };

        } catch (error) {
            logger.error(`執行套利交易失敗 ${id}:`, error);
            
            this.emit('arbitrageExecuted', {
                opportunity,
                error: error.message,
                success: false
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * 風險檢查
     */
    performRiskCheck(amount) {
        const checks = [];

        // 檢查單筆交易金額
        if (amount > this.riskLimits.maxPositionSize) {
            return {
                passed: false,
                reason: `交易金額超過限制: ${amount} > ${this.riskLimits.maxPositionSize}`
            };
        }

        // 檢查今日虧損
        if (this.stats.todayProfit < -this.riskLimits.maxDailyLoss) {
            return {
                passed: false,
                reason: `今日虧損超過限制: ${this.stats.todayProfit} < -${this.riskLimits.maxDailyLoss}`
            };
        }

        return { passed: true };
    }

    /**
     * 更新統計數據
     */
    updateStats(result, opportunity) {
        this.stats.totalTrades += 1;
        
        if (result.success) {
            this.stats.successfulTrades += 1;
            
            // 估算利潤（簡化計算）
            const estimatedProfit = Math.abs(opportunity.spread) * opportunity.pairConfig.amount;
            this.stats.totalProfit += estimatedProfit;
            this.stats.todayProfit += estimatedProfit;
        }

        // 檢查是否需要重置今日統計
        const today = new Date().toDateString();
        if (this.stats.lastResetDate !== today) {
            this.stats.todayProfit = 0;
            this.stats.lastResetDate = today;
        }
    }

    /**
     * 添加TWAP策略
     * 用戶自定義標的、數量、時間間隔
     */
    addTwapStrategy(config) {
        const {
            id,
            exchange = 'bybit',
            symbol,
            side, // 'buy' or 'sell'
            totalAmount,
            timeInterval, // 執行間隔（毫秒）
            orderCount, // 分割訂單數量
            priceType = 'market', // 'market' or 'limit'
            enabled = true
        } = config;

        const strategy = {
            id,
            exchange,
            symbol,
            side,
            totalAmount: parseFloat(totalAmount),
            timeInterval: parseInt(timeInterval),
            orderCount: parseInt(orderCount),
            amountPerOrder: parseFloat(totalAmount) / parseInt(orderCount),
            priceType,
            enabled,
            createdAt: Date.now(),
            executedOrders: 0,
            remainingAmount: parseFloat(totalAmount),
            nextExecutionTime: Date.now() + parseInt(timeInterval),
            status: 'active'
        };

        this.twapStrategies.set(id, strategy);
        
        logger.info('添加TWAP策略', strategy);
        this.emit('twapStrategyAdded', strategy);

        return strategy;
    }

    /**
     * 執行TWAP策略
     */
    async executeTwapStrategies() {
        const now = Date.now();

        for (const [id, strategy] of this.twapStrategies) {
            if (!strategy.enabled || strategy.status !== 'active') continue;
            if (now < strategy.nextExecutionTime) continue;
            if (strategy.executedOrders >= strategy.orderCount) {
                strategy.status = 'completed';
                continue;
            }

            try {
                await this.executeTwapOrder(strategy);
            } catch (error) {
                logger.error(`執行TWAP策略 ${id} 失敗:`, error);
            }
        }
    }

    /**
     * 執行單個TWAP訂單
     */
    async executeTwapOrder(strategy) {
        const { id, exchange, symbol, side, amountPerOrder, priceType } = strategy;

        try {
            let result;
            
            if (priceType === 'market') {
                result = await this.exchanges[exchange].placeMarketOrder(symbol, side, amountPerOrder);
            } else {
                // 限價單需要獲取當前市價
                const orderBook = await this.exchanges[exchange].getOrderBook(symbol);
                const price = side === 'buy' ? orderBook.ask1.price : orderBook.bid1.price;
                result = await this.exchanges[exchange].placeLimitOrder(symbol, side, amountPerOrder, price);
            }

            // 更新策略狀態
            strategy.executedOrders += 1;
            strategy.remainingAmount -= amountPerOrder;
            strategy.nextExecutionTime = Date.now() + strategy.timeInterval;

            logger.trading('TWAP訂單執行', {
                strategyId: id,
                executedOrders: strategy.executedOrders,
                totalOrders: strategy.orderCount,
                remainingAmount: strategy.remainingAmount
            });

            this.emit('twapOrderExecuted', { strategy, result });

        } catch (error) {
            logger.error(`TWAP訂單執行失敗 ${id}:`, error);
            throw error;
        }
    }

    /**
     * 獲取引擎狀態
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            monitoringPairs: Array.from(this.monitoringPairs.values()),
            twapStrategies: Array.from(this.twapStrategies.values()),
            stats: this.stats,
            riskLimits: this.riskLimits,
            exchanges: {
                bybit: {
                    connected: this.exchanges.bybit.isExchangeConnected(),
                    availableSymbols: this.exchanges.bybit.getAvailableSymbols().length
                }
            }
        };
    }
}

// 全域引擎實例
let engineInstance = null;

/**
 * 啟動套利引擎（單例模式）
 */
async function startArbitrageEngine() {
    if (!engineInstance) {
        engineInstance = new ArbitrageEngine();
    }
    
    if (!engineInstance.isRunning) {
        await engineInstance.start();
    }
    
    return engineInstance;
}

/**
 * 獲取引擎實例
 */
function getArbitrageEngine() {
    return engineInstance;
}

module.exports = {
    ArbitrageEngine,
    startArbitrageEngine,
    getArbitrageEngine
};
