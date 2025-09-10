/**
 * 優化版套利引擎
 * 針對跨交易所套利進行性能優化
 */
const ExchangeFactory = require('../exchanges/index');
const BinanceExchange = require('../exchanges/binance/BinanceExchange');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class ArbitrageEngineOptimized extends EventEmitter {
    constructor() {
        super();
        
        // 交易所服務實例
        this.exchanges = {
            bybit: null, // 將在啟動時初始化
            binance: null
        };

        // 監控配置
        this.monitoringPairs = new Map();
        this.activeStrategies = new Map();
        this.twapStrategies = new Map();
        
        // 系統狀態
        this.isRunning = false;
        this.monitoringInterval = null;
        this.priceUpdateInterval = 500; // 優化：500ms 更新一次價格
        
        // 性能優化配置
        this.performanceConfig = {
            maxConcurrentRequests: 10,
            requestTimeout: 5000,
            priceCacheTimeout: 1000,
            batchSize: 50
        };

        // 緩存系統
        this.priceCache = new Map();
        this.cacheTimestamps = new Map();
        
        // 請求隊列
        this.requestQueue = [];
        this.activeRequests = 0;
        
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
            averageExecutionTime: 0,
            cacheHitRate: 0,
            errorRate: 0
        };
    }

    /**
     * 啟動優化版套利引擎
     */
    async start() {
        try {
            logger.info('正在啟動優化版套利引擎...');

            // 初始化交易所連接
            await this.initializeExchanges();
            
            // 啟動價格監控
            this.startOptimizedPriceMonitoring();
            
            // 啟動請求處理器
            this.startRequestProcessor();
            
            this.isRunning = true;
            logger.info('✅ 優化版套利引擎啟動成功');

            this.emit('engineStarted');

        } catch (error) {
            logger.error('優化版套利引擎啟動失敗:', error);
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
     * 啟動優化版價格監控
     */
    startOptimizedPriceMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.updatePriceCache();
                await this.detectArbitrageOpportunities();
            } catch (error) {
                logger.error('價格監控錯誤:', error);
            }
        }, this.priceUpdateInterval);
    }

    /**
     * 啟動請求處理器
     */
    startRequestProcessor() {
        setInterval(() => {
            this.processRequestQueue();
        }, 100); // 每 100ms 處理一次隊列
    }

    /**
     * 更新價格緩存
     */
    async updatePriceCache() {
        const symbols = Array.from(this.monitoringPairs.keys());
        const now = Date.now();
        
        // 批量獲取價格
        const pricePromises = symbols.map(symbol => 
            this.getCachedPrice(symbol)
        );
        
        try {
            await Promise.allSettled(pricePromises);
        } catch (error) {
            logger.error('價格緩存更新失敗:', error);
        }
    }

    /**
     * 獲取緩存價格
     */
    async getCachedPrice(symbol) {
        const cacheKey = symbol;
        const now = Date.now();
        const cacheTimeout = this.performanceConfig.priceCacheTimeout;
        
        // 檢查緩存是否有效
        if (this.priceCache.has(cacheKey) && 
            this.cacheTimestamps.has(cacheKey) &&
            (now - this.cacheTimestamps.get(cacheKey)) < cacheTimeout) {
            this.stats.cacheHitRate = (this.stats.cacheHitRate + 1) / 2; // 簡單移動平均
            return this.priceCache.get(cacheKey);
        }
        
        // 緩存失效，獲取新價格
        try {
            const prices = await this.getCrossExchangePrices(symbol);
            this.priceCache.set(cacheKey, prices);
            this.cacheTimestamps.set(cacheKey, now);
            return prices;
        } catch (error) {
            logger.error(`獲取 ${symbol} 價格失敗:`, error);
            throw error;
        }
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
            this.updateExecutionTimeStats(executionTime);
            
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
            this.updateExecutionTimeStats(executionTime);
            
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
     * 更新執行時間統計
     */
    updateExecutionTimeStats(executionTime) {
        if (this.stats.averageExecutionTime === 0) {
            this.stats.averageExecutionTime = executionTime;
        } else {
            this.stats.averageExecutionTime = 
                (this.stats.averageExecutionTime + executionTime) / 2;
        }
    }

    /**
     * 處理請求隊列
     */
    async processRequestQueue() {
        if (this.requestQueue.length === 0 || 
            this.activeRequests >= this.performanceConfig.maxConcurrentRequests) {
            return;
        }
        
        const request = this.requestQueue.shift();
        this.activeRequests++;
        
        try {
            await request.execute();
        } catch (error) {
            logger.error('請求處理失敗:', error);
        } finally {
            this.activeRequests--;
        }
    }

    /**
     * 添加請求到隊列
     */
    addRequest(request) {
        this.requestQueue.push({
            ...request,
            timestamp: Date.now()
        });
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
            logger.info('正在停止優化版套利引擎...');
            
            this.isRunning = false;
            
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }
            
            // 清理緩存
            this.priceCache.clear();
            this.cacheTimestamps.clear();
            
            logger.info('✅ 優化版套利引擎已停止');
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
            cacheSize: this.priceCache.size,
            queueSize: this.requestQueue.length,
            activeRequests: this.activeRequests,
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

module.exports = ArbitrageEngineOptimized;

