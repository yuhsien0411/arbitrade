/**
 * 優化版套利引擎 V2
 * 針對跨交易所套利進行全面性能優化
 */
const ExchangeFactory = require('../exchanges/index');
const BybitCompatibilityAdapter = require('../exchanges/bybit/BybitCompatibilityAdapter');
const BinanceExchange = require('../exchanges/binance/BinanceExchange');
const ArbitragePerformanceMonitor = require('./ArbitragePerformanceMonitor');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class ArbitrageEngineV2 extends EventEmitter {
    constructor() {
        super();
        
        // 交易所服務實例
        this.exchanges = {
            bybit: BybitCompatibilityAdapter,
            binance: null
        };

        // 監控配置
        this.monitoringPairs = new Map();
        this.activeStrategies = new Map();
        this.twapStrategies = new Map();
        
        // 系統狀態
        this.isRunning = false;
        this.monitoringInterval = null;
        this.priceUpdateInterval = 200; // 優化：200ms 更新一次價格
        
        // 性能優化配置
        this.performanceConfig = {
            maxConcurrentRequests: 20,
            requestTimeout: 3000,
            priceCacheTimeout: 500,
            batchSize: 100,
            maxRetries: 3,
            retryDelay: 1000
        };

        // 緩存系統
        this.priceCache = new Map();
        this.cacheTimestamps = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        // 請求隊列和限流
        this.requestQueue = [];
        this.activeRequests = 0;
        this.rateLimiter = new Map();
        
        // 性能監控
        this.performanceMonitor = new ArbitragePerformanceMonitor();
        
        // 風險控制參數
        this.riskLimits = {
            maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 10000,
            maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 1000,
            priceDeviationThreshold: parseFloat(process.env.PRICE_DEVIATION_THRESHOLD) || 0.05,
            maxConcurrentTrades: 5
        };

        // 績效統計
        this.stats = {
            totalTrades: 0,
            successfulTrades: 0,
            totalProfit: 0,
            todayProfit: 0,
            averageExecutionTime: 0,
            cacheHitRate: 0,
            errorRate: 0,
            lastResetTime: Date.now()
        };

        // 智能配置
        this.smartConfig = {
            adaptiveInterval: true,
            dynamicBatchSize: true,
            intelligentCaching: true,
            predictiveScaling: true
        };
    }

    /**
     * 啟動優化版套利引擎 V2
     */
    async start() {
        try {
            logger.info('正在啟動優化版套利引擎 V2...');

            // 初始化交易所連接
            await this.initializeExchanges();
            
            // 啟動性能監控
            this.performanceMonitor.startMonitoring(2000);
            
            // 啟動智能價格監控
            this.startIntelligentPriceMonitoring();
            
            // 啟動請求處理器
            this.startAdvancedRequestProcessor();
            
            // 啟動智能優化器
            this.startIntelligentOptimizer();
            
            this.isRunning = true;
            logger.info('✅ 優化版套利引擎 V2 啟動成功');

            this.emit('engineStarted');

        } catch (error) {
            logger.error('優化版套利引擎 V2 啟動失敗:', error);
            throw error;
        }
    }

    /**
     * 初始化交易所連接
     */
    async initializeExchanges() {
        // 初始化 Bybit
        await this.exchanges.bybit.initialize();
        
        // 初始化 Binance（如果配置了 API 密鑰）
        if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
            try {
                this.exchanges.binance = new BinanceExchange({
                    apiKey: process.env.BINANCE_API_KEY,
                    secret: process.env.BINANCE_SECRET_KEY,
                    testnet: process.env.BINANCE_TESTNET === 'true'
                });
                await this.exchanges.binance.initialize();
                logger.info('✅ Binance 交易所初始化成功');
            } catch (error) {
                logger.warn('Binance 交易所初始化失敗，將跳過:', error.message);
                this.exchanges.binance = null;
            }
        }
    }

    /**
     * 啟動智能價格監控
     */
    startIntelligentPriceMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.updateIntelligentPriceCache();
                await this.detectArbitrageOpportunities();
                await this.optimizePerformance();
            } catch (error) {
                logger.error('智能價格監控錯誤:', error);
            }
        }, this.priceUpdateInterval);
    }

    /**
     * 啟動高級請求處理器
     */
    startAdvancedRequestProcessor() {
        setInterval(() => {
            this.processAdvancedRequestQueue();
        }, 50); // 每 50ms 處理一次隊列
    }

    /**
     * 啟動智能優化器
     */
    startIntelligentOptimizer() {
        setInterval(() => {
            this.optimizeSystemPerformance();
        }, 10000); // 每 10 秒優化一次
    }

    /**
     * 更新智能價格緩存
     */
    async updateIntelligentPriceCache() {
        const symbols = Array.from(this.monitoringPairs.keys());
        const now = Date.now();
        
        // 智能批量獲取價格
        const pricePromises = this.createIntelligentBatches(symbols).map(batch => 
            this.getBatchPrices(batch)
        );
        
        try {
            const results = await Promise.allSettled(pricePromises);
            this.processBatchResults(results);
        } catch (error) {
            logger.error('智能價格緩存更新失敗:', error);
        }
    }

    /**
     * 創建智能批次
     */
    createIntelligentBatches(symbols) {
        const batchSize = this.calculateOptimalBatchSize();
        const batches = [];
        
        for (let i = 0; i < symbols.length; i += batchSize) {
            batches.push(symbols.slice(i, i + batchSize));
        }
        
        return batches;
    }

    /**
     * 計算最優批次大小
     */
    calculateOptimalBatchSize() {
        if (!this.smartConfig.dynamicBatchSize) {
            return this.performanceConfig.batchSize;
        }
        
        const currentLoad = this.activeRequests / this.performanceConfig.maxConcurrentRequests;
        const baseSize = this.performanceConfig.batchSize;
        
        if (currentLoad > 0.8) {
            return Math.max(10, Math.floor(baseSize * 0.5));
        } else if (currentLoad < 0.3) {
            return Math.min(200, Math.floor(baseSize * 1.5));
        }
        
        return baseSize;
    }

    /**
     * 獲取批次價格
     */
    async getBatchPrices(symbols) {
        const startTime = Date.now();
        
        try {
            const promises = symbols.map(symbol => 
                this.getCachedPrice(symbol)
            );
            
            const results = await Promise.allSettled(promises);
            const duration = Date.now() - startTime;
            
            this.performanceMonitor.recordDetectionTime(duration);
            
            return results;
        } catch (error) {
            logger.error('批次價格獲取失敗:', error);
            throw error;
        }
    }

    /**
     * 處理批次結果
     */
    processBatchResults(results) {
        results.forEach(batchResult => {
            if (batchResult.status === 'fulfilled') {
                batchResult.value.forEach(symbolResult => {
                    if (symbolResult.status === 'fulfilled') {
                        this.cacheHits++;
                    } else {
                        this.cacheMisses++;
                    }
                });
            }
        });
        
        this.updateCacheHitRate();
    }

    /**
     * 獲取緩存價格
     */
    async getCachedPrice(symbol) {
        const cacheKey = symbol;
        const now = Date.now();
        const cacheTimeout = this.calculateCacheTimeout();
        
        // 檢查緩存是否有效
        if (this.priceCache.has(cacheKey) && 
            this.cacheTimestamps.has(cacheKey) &&
            (now - this.cacheTimestamps.get(cacheKey)) < cacheTimeout) {
            this.cacheHits++;
            return this.priceCache.get(cacheKey);
        }
        
        // 緩存失效，獲取新價格
        try {
            const prices = await this.getCrossExchangePrices(symbol);
            this.priceCache.set(cacheKey, prices);
            this.cacheTimestamps.set(cacheKey, now);
            this.cacheMisses++;
            return prices;
        } catch (error) {
            logger.error(`獲取 ${symbol} 價格失敗:`, error);
            throw error;
        }
    }

    /**
     * 計算緩存超時時間
     */
    calculateCacheTimeout() {
        if (!this.smartConfig.intelligentCaching) {
            return this.performanceConfig.priceCacheTimeout;
        }
        
        const marketVolatility = this.calculateMarketVolatility();
        const baseTimeout = this.performanceConfig.priceCacheTimeout;
        
        if (marketVolatility > 0.05) {
            return Math.max(100, baseTimeout * 0.5); // 高波動時縮短緩存時間
        } else {
            return Math.min(2000, baseTimeout * 1.5); // 低波動時延長緩存時間
        }
    }

    /**
     * 計算市場波動性
     */
    calculateMarketVolatility() {
        // 簡化的波動性計算
        const recentPrices = Array.from(this.priceCache.values()).slice(-10);
        if (recentPrices.length < 2) return 0;
        
        let totalVolatility = 0;
        for (let i = 1; i < recentPrices.length; i++) {
            const price1 = recentPrices[i - 1];
            const price2 = recentPrices[i];
            if (price1 && price2) {
                const volatility = Math.abs(price1 - price2) / price1;
                totalVolatility += volatility;
            }
        }
        
        return totalVolatility / (recentPrices.length - 1);
    }

    /**
     * 獲取跨交易所價格
     */
    async getCrossExchangePrices(symbol) {
        const startTime = Date.now();
        
        try {
            const [bybitPrice, binancePrice] = await Promise.allSettled([
                this.exchanges.bybit.getOrderBook(symbol),
                this.exchanges.binance ? 
                    this.exchanges.binance.getOrderBook(symbol, 'spot') : 
                    Promise.resolve(null)
            ]);
            
            const executionTime = Date.now() - startTime;
            this.performanceMonitor.recordAPIResponseTime('bybit', 'getOrderBook', executionTime);
            
            return {
                bybit: bybitPrice.status === 'fulfilled' ? bybitPrice.value : null,
                binance: binancePrice.status === 'fulfilled' ? binancePrice.value : null,
                timestamp: Date.now(),
                executionTime
            };
        } catch (error) {
            this.stats.errorRate = (this.stats.errorRate + 1) / 2;
            throw error;
        }
    }

    /**
     * 檢測套利機會
     */
    async detectArbitrageOpportunities() {
        for (const [symbol, config] of this.monitoringPairs) {
            try {
                const prices = await this.getCachedPrice(symbol);
                if (!prices.bybit || !prices.binance) continue;
                
                const opportunity = this.calculateArbitrageOpportunity(symbol, prices, config);
                if (opportunity) {
                    this.emit('arbitrageOpportunity', opportunity);
                    await this.executeArbitrageStrategy(opportunity);
                }
            } catch (error) {
                logger.error(`檢測 ${symbol} 套利機會失敗:`, error);
            }
        }
    }

    /**
     * 計算套利機會
     */
    calculateArbitrageOpportunity(symbol, prices, config) {
        const bybitData = prices.bybit.data;
        const binanceData = prices.binance.data;
        
        if (!bybitData || !binanceData) return null;
        
        const bybitBid = parseFloat(bybitData.bids[0][0]);
        const bybitAsk = parseFloat(bybitData.asks[0][0]);
        const binanceBid = parseFloat(binanceData.bids[0][0]);
        const binanceAsk = parseFloat(binanceData.asks[0][0]);
        
        // 計算價差
        const buyBinanceSellBybit = bybitBid - binanceAsk;
        const buyBybitSellBinance = binanceBid - bybitAsk;
        
        const maxProfit = Math.max(buyBinanceSellBybit, buyBybitSellBinance);
        const profitPercent = (maxProfit / Math.min(bybitBid, binanceAsk)) * 100;
        
        if (profitPercent > config.minProfitPercent) {
            return {
                symbol,
                strategy: buyBinanceSellBybit > buyBybitSellBinance ? 
                    'buyBinanceSellBybit' : 'buyBybitSellBinance',
                profit: maxProfit,
                profitPercent,
                bybitBid,
                bybitAsk,
                binanceBid,
                binanceAsk,
                timestamp: Date.now()
            };
        }
        
        return null;
    }

    /**
     * 執行套利策略
     */
    async executeArbitrageStrategy(opportunity) {
        try {
            const startTime = Date.now();
            
            if (opportunity.strategy === 'buyBinanceSellBybit') {
                await this.executeBuyBinanceSellBybit(opportunity);
            } else {
                await this.executeBuyBybitSellBinance(opportunity);
            }
            
            const executionTime = Date.now() - startTime;
            this.performanceMonitor.recordArbitrageExecution(true, executionTime, opportunity.profit);
            
            this.stats.totalTrades++;
            this.stats.successfulTrades++;
            this.stats.totalProfit += opportunity.profit;
            
            this.emit('arbitrageExecuted', {
                ...opportunity,
                executionTime
            });
            
        } catch (error) {
            logger.error('套利策略執行失敗:', error);
            this.stats.totalTrades++;
            this.stats.errorRate = (this.stats.errorRate + 1) / 2;
            this.performanceMonitor.recordArbitrageExecution(false, 0, 0);
        }
    }

    /**
     * 執行買 Binance 賣 Bybit 策略
     */
    async executeBuyBinanceSellBybit(opportunity) {
        const { symbol, binanceAsk, bybitBid } = opportunity;
        const amount = this.calculateOrderAmount(opportunity);
        
        // 並發執行訂單
        const [binanceOrder, bybitOrder] = await Promise.allSettled([
            this.exchanges.binance.placeOrder({
                symbol,
                side: 'buy',
                amount,
                price: binanceAsk,
                type: 'limit'
            }),
            this.exchanges.bybit.placeOrder({
                symbol,
                side: 'sell',
                amount,
                price: bybitBid,
                type: 'limit'
            })
        ]);
        
        if (binanceOrder.status === 'rejected' || bybitOrder.status === 'rejected') {
            throw new Error('訂單執行失敗');
        }
    }

    /**
     * 執行買 Bybit 賣 Binance 策略
     */
    async executeBuyBybitSellBinance(opportunity) {
        const { symbol, bybitAsk, binanceBid } = opportunity;
        const amount = this.calculateOrderAmount(opportunity);
        
        // 並發執行訂單
        const [bybitOrder, binanceOrder] = await Promise.allSettled([
            this.exchanges.bybit.placeOrder({
                symbol,
                side: 'buy',
                amount,
                price: bybitAsk,
                type: 'limit'
            }),
            this.exchanges.binance.placeOrder({
                symbol,
                side: 'sell',
                amount,
                price: binanceBid,
                type: 'limit'
            })
        ]);
        
        if (bybitOrder.status === 'rejected' || binanceOrder.status === 'rejected') {
            throw new Error('訂單執行失敗');
        }
    }

    /**
     * 計算訂單數量
     */
    calculateOrderAmount(opportunity) {
        const maxAmount = this.riskLimits.maxPositionSize / opportunity.bybitBid;
        const minAmount = 0.001; // 最小交易量
        return Math.min(maxAmount, Math.max(minAmount, 0.1)); // 默認 0.1 BTC
    }

    /**
     * 處理高級請求隊列
     */
    async processAdvancedRequestQueue() {
        if (this.requestQueue.length === 0 || 
            this.activeRequests >= this.performanceConfig.maxConcurrentRequests) {
            return;
        }
        
        const request = this.requestQueue.shift();
        this.activeRequests++;
        
        try {
            await this.executeRequestWithRetry(request);
        } catch (error) {
            logger.error('請求處理失敗:', error);
            this.performanceMonitor.recordError('REQUEST_FAILED', error.message);
        } finally {
            this.activeRequests--;
        }
    }

    /**
     * 執行帶重試的請求
     */
    async executeRequestWithRetry(request, retryCount = 0) {
        try {
            await request.execute();
        } catch (error) {
            if (retryCount < this.performanceConfig.maxRetries) {
                await new Promise(resolve => 
                    setTimeout(resolve, this.performanceConfig.retryDelay * (retryCount + 1))
                );
                return this.executeRequestWithRetry(request, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * 添加請求到隊列
     */
    addRequest(request) {
        this.requestQueue.push({
            ...request,
            timestamp: Date.now(),
            priority: request.priority || 0
        });
        
        // 按優先級排序
        this.requestQueue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * 優化系統性能
     */
    optimizeSystemPerformance() {
        // 更新緩存命中率
        this.updateCacheHitRate();
        
        // 優化價格更新間隔
        if (this.smartConfig.adaptiveInterval) {
            this.optimizePriceUpdateInterval();
        }
        
        // 清理過期緩存
        this.cleanupExpiredCache();
        
        // 優化內存使用
        this.optimizeMemoryUsage();
    }

    /**
     * 更新緩存命中率
     */
    updateCacheHitRate() {
        const total = this.cacheHits + this.cacheMisses;
        if (total > 0) {
            this.stats.cacheHitRate = this.cacheHits / total;
        }
    }

    /**
     * 優化價格更新間隔
     */
    optimizePriceUpdateInterval() {
        const currentLoad = this.activeRequests / this.performanceConfig.maxConcurrentRequests;
        const baseInterval = 200;
        
        if (currentLoad > 0.8) {
            this.priceUpdateInterval = Math.min(1000, baseInterval * 2);
        } else if (currentLoad < 0.3) {
            this.priceUpdateInterval = Math.max(100, baseInterval * 0.5);
        } else {
            this.priceUpdateInterval = baseInterval;
        }
    }

    /**
     * 清理過期緩存
     */
    cleanupExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, timestamp] of this.cacheTimestamps) {
            if (now - timestamp > this.performanceConfig.priceCacheTimeout * 2) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => {
            this.priceCache.delete(key);
            this.cacheTimestamps.delete(key);
        });
    }

    /**
     * 優化內存使用
     */
    optimizeMemoryUsage() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        if (heapUsedMB > 100) {
            // 強制垃圾回收
            if (global.gc) {
                global.gc();
            }
            
            // 清理緩存
            this.cleanupExpiredCache();
        }
    }

    /**
     * 添加監控交易對
     */
    addMonitoringPair(symbol, config) {
        this.monitoringPairs.set(symbol, {
            minProfitPercent: 0.1, // 0.1% 最小利潤
            maxAmount: 1.0,
            enabled: true,
            ...config
        });
    }

    /**
     * 停止套利引擎
     */
    async stop() {
        try {
            logger.info('正在停止優化版套利引擎 V2...');
            
            this.isRunning = false;
            
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }
            
            // 停止性能監控
            this.performanceMonitor.stopMonitoring();
            
            // 清理緩存
            this.priceCache.clear();
            this.cacheTimestamps.clear();
            
            logger.info('✅ 優化版套利引擎 V2 已停止');
            this.emit('engineStopped');
            
        } catch (error) {
            logger.error('停止套利引擎失敗:', error);
        }
    }

    /**
     * 獲取優化版引擎狀態
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            monitoringPairs: Array.from(this.monitoringPairs.values()),
            stats: this.stats,
            performanceConfig: this.performanceConfig,
            smartConfig: this.smartConfig,
            cacheSize: this.priceCache.size,
            cacheHitRate: this.stats.cacheHitRate,
            queueSize: this.requestQueue.length,
            activeRequests: this.activeRequests,
            performanceReport: this.performanceMonitor.getPerformanceReport(),
            exchanges: {
                bybit: {
                    connected: this.exchanges.bybit.isExchangeConnected(),
                    availableSymbols: this.exchanges.bybit.getAvailableSymbols().length
                },
                binance: this.exchanges.binance ? {
                    connected: this.exchanges.binance.isConnected,
                    availableSymbols: this.exchanges.binance.getAvailableSymbols ? 
                        this.exchanges.binance.getAvailableSymbols().length : 0
                } : {
                    connected: false,
                    availableSymbols: 0
                }
            }
        };
    }
}

module.exports = ArbitrageEngineV2;
