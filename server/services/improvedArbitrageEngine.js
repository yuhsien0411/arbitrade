/**
 * 改進版套利引擎
 * 整合了更好的錯誤處理、性能優化和監控功能
 */

const EventEmitter = require('events');
const ExchangeFactory = require('../exchanges');
const logger = require('../utils/logger');
const TradingError = require('../utils/TradingError');

class ImprovedArbitrageEngine extends EventEmitter {
    constructor() {
        super();
        
        // 交易所管理
        this.exchanges = new Map();
        
        // 策略管理
        this.strategies = {
            arbitrage: new Map(),
            twap: new Map(),
            gridTrading: new Map()
        };
        
        // 性能監控
        this.metrics = {
            totalOpportunities: 0,
            executedTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalProfit: 0,
            totalVolume: 0,
            averageSpread: 0,
            lastUpdateTime: Date.now()
        };
        
        // 配置
        this.config = {
            scanInterval: 1000, // 掃描間隔（毫秒）
            maxConcurrentTrades: 5,
            enableAutoTrade: false,
            minSpreadThreshold: 0.1, // 最小價差閾值（%）
            maxPositionSize: 10000,
            emergencyStop: false
        };
        
        // 狀態
        this.isRunning = false;
        this.scanTimer = null;
        this.activeTrades = new Set();
    }

    /**
     * 初始化引擎
     */
    async initialize() {
        try {
            logger.info('初始化改進版套利引擎...');
            
            // 初始化 Bybit 交易所
            await this.initializeExchange('bybit', {
                name: 'Bybit',
                apiKey: process.env.BYBIT_API_KEY,
                secret: process.env.BYBIT_SECRET,
                testnet: process.env.BYBIT_TESTNET === 'true'
            });
            
            // 設置錯誤處理
            this.setupErrorHandlers();
            
            // 設置性能監控
            this.setupMetricsCollection();
            
            this.isRunning = true;
            logger.info('✅ 改進版套利引擎初始化成功');
            
            return true;
        } catch (error) {
            logger.error('套利引擎初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 初始化交易所
     */
    async initializeExchange(name, config) {
        try {
            const exchange = ExchangeFactory.createExchange(name, config);
            await exchange.initialize();
            this.exchanges.set(name, exchange);
            
            // 設置交易所事件監聽
            exchange.on('ticker', (data) => this.handleTickerUpdate(data));
            exchange.on('orderbook', (data) => this.handleOrderBookUpdate(data));
            exchange.on('position', (data) => this.handlePositionUpdate(data));
            
            logger.info(`✅ ${name} 交易所初始化成功`);
            return exchange;
        } catch (error) {
            logger.error(`${name} 交易所初始化失敗:`, error);
            throw error;
        }
    }

    /**
     * 開始掃描套利機會
     */
    startScanning() {
        if (this.scanTimer) {
            clearInterval(this.scanTimer);
        }
        
        this.scanTimer = setInterval(async () => {
            if (this.config.emergencyStop) {
                logger.warn('緊急停止已啟動，跳過掃描');
                return;
            }
            
            await this.scanForOpportunities();
        }, this.config.scanInterval);
        
        logger.info(`開始掃描套利機會，間隔: ${this.config.scanInterval}ms`);
    }

    /**
     * 停止掃描
     */
    stopScanning() {
        if (this.scanTimer) {
            clearInterval(this.scanTimer);
            this.scanTimer = null;
        }
        logger.info('停止掃描套利機會');
    }

    /**
     * 掃描套利機會
     */
    async scanForOpportunities() {
        try {
            const opportunities = [];
            
            // 遍歷所有套利策略
            for (const [id, strategy] of this.strategies.arbitrage) {
                if (!strategy.enabled) continue;
                
                const opportunity = await this.analyzeStrategy(strategy);
                if (opportunity && opportunity.profitable) {
                    opportunities.push(opportunity);
                    this.metrics.totalOpportunities++;
                }
            }
            
            // 排序機會（按利潤降序）
            opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
            
            // 發送機會事件
            if (opportunities.length > 0) {
                this.emit('opportunities', opportunities);
                
                // 自動執行交易（如果啟用）
                if (this.config.enableAutoTrade) {
                    await this.executeTopOpportunities(opportunities);
                }
            }
            
            // 更新指標
            this.updateMetrics();
            
        } catch (error) {
            logger.error('掃描套利機會時發生錯誤:', error);
            this.emit('error', error);
        }
    }

    /**
     * 分析策略
     */
    async analyzeStrategy(strategy) {
        try {
            const { leg1, leg2, threshold } = strategy;
            
            // 獲取價格數據
            const [price1, price2] = await Promise.all([
                this.getPrice(leg1.exchange, leg1.symbol, leg1.type),
                this.getPrice(leg2.exchange, leg2.symbol, leg2.type)
            ]);
            
            if (!price1 || !price2) {
                return null;
            }
            
            // 計算價差
            const spread = this.calculateSpread(price1, price2, strategy);
            
            // 檢查是否有利可圖
            const profitable = Math.abs(spread.percentage) >= threshold;
            
            return {
                strategyId: strategy.id,
                strategy,
                price1,
                price2,
                spread,
                profitable,
                estimatedProfit: this.estimateProfit(spread, strategy.amount),
                timestamp: Date.now()
            };
            
        } catch (error) {
            logger.error(`分析策略 ${strategy.id} 失敗:`, error);
            return null;
        }
    }

    /**
     * 獲取價格
     */
    async getPrice(exchangeName, symbol, type) {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
            throw new TradingError(`交易所 ${exchangeName} 未初始化`, 'EXCHANGE_NOT_FOUND', exchangeName);
        }
        
        // 優先使用緩存的頂部報價
        let price = exchange.getTopOfBook(symbol);
        
        // 如果沒有緩存，則從 REST API 獲取
        if (!price) {
            const orderbook = await exchange.getOrderBook(symbol, type);
            if (orderbook.success && orderbook.data) {
                const data = orderbook.data;
                price = {
                    symbol,
                    exchange: exchangeName,
                    bid1: data.b && data.b[0] ? { 
                        price: Number(data.b[0][0]), 
                        amount: Number(data.b[0][1]) 
                    } : null,
                    ask1: data.a && data.a[0] ? { 
                        price: Number(data.a[0][0]), 
                        amount: Number(data.a[0][1]) 
                    } : null
                };
            }
        }
        
        return price;
    }

    /**
     * 計算價差
     */
    calculateSpread(price1, price2, strategy) {
        const { leg1, leg2 } = strategy;
        
        let buyPrice, sellPrice;
        
        if (leg1.side === 'buy' && leg2.side === 'sell') {
            buyPrice = price1.ask1?.price || 0;
            sellPrice = price2.bid1?.price || 0;
        } else if (leg1.side === 'sell' && leg2.side === 'buy') {
            sellPrice = price1.bid1?.price || 0;
            buyPrice = price2.ask1?.price || 0;
        } else {
            // 默認：leg1 賣出，leg2 買入
            sellPrice = price1.bid1?.price || 0;
            buyPrice = price2.ask1?.price || 0;
        }
        
        const absolute = sellPrice - buyPrice;
        const percentage = (absolute / buyPrice) * 100;
        
        return {
            absolute,
            percentage,
            buyPrice,
            sellPrice
        };
    }

    /**
     * 估算利潤
     */
    estimateProfit(spread, amount) {
        // 簡單估算，實際應考慮手續費、滑點等
        const grossProfit = spread.absolute * amount;
        const fees = amount * 0.001 * 2; // 假設雙邊手續費各 0.1%
        return grossProfit - fees;
    }

    /**
     * 執行最佳機會
     */
    async executeTopOpportunities(opportunities) {
        const maxTrades = Math.min(
            opportunities.length,
            this.config.maxConcurrentTrades - this.activeTrades.size
        );
        
        for (let i = 0; i < maxTrades; i++) {
            const opportunity = opportunities[i];
            
            // 風險檢查
            if (!this.passRiskCheck(opportunity)) {
                logger.warn(`機會 ${opportunity.strategyId} 未通過風險檢查`);
                continue;
            }
            
            // 執行交易
            this.executeTrade(opportunity);
        }
    }

    /**
     * 風險檢查
     */
    passRiskCheck(opportunity) {
        // 檢查倉位大小
        if (opportunity.strategy.amount > this.config.maxPositionSize) {
            return false;
        }
        
        // 檢查價差是否足夠
        if (Math.abs(opportunity.spread.percentage) < this.config.minSpreadThreshold) {
            return false;
        }
        
        // 檢查並發交易數
        if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
            return false;
        }
        
        return true;
    }

    /**
     * 執行交易
     */
    async executeTrade(opportunity) {
        const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.activeTrades.add(tradeId);
        
        try {
            logger.info(`執行交易 ${tradeId}`, opportunity);
            
            const { strategy } = opportunity;
            const { leg1, leg2 } = strategy;
            
            // 並行執行雙腿訂單
            const [order1, order2] = await Promise.all([
                this.placeOrder(leg1.exchange, {
                    symbol: leg1.symbol,
                    side: leg1.side || 'sell',
                    orderType: 'Market',
                    qty: strategy.amount,
                    category: leg1.type
                }),
                this.placeOrder(leg2.exchange, {
                    symbol: leg2.symbol,
                    side: leg2.side || 'buy',
                    orderType: 'Market',
                    qty: strategy.amount,
                    category: leg2.type
                })
            ]);
            
            // 記錄成功交易
            this.metrics.executedTrades++;
            this.metrics.successfulTrades++;
            this.metrics.totalVolume += strategy.amount * 2;
            this.metrics.totalProfit += opportunity.estimatedProfit;
            
            // 發送交易完成事件
            this.emit('tradeExecuted', {
                tradeId,
                opportunity,
                order1,
                order2,
                success: true
            });
            
            logger.info(`✅ 交易 ${tradeId} 執行成功`);
            
        } catch (error) {
            logger.error(`交易 ${tradeId} 執行失敗:`, error);
            this.metrics.failedTrades++;
            
            this.emit('tradeExecuted', {
                tradeId,
                opportunity,
                success: false,
                error: error.message
            });
            
        } finally {
            this.activeTrades.delete(tradeId);
        }
    }

    /**
     * 下單
     */
    async placeOrder(exchangeName, orderParams) {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
            throw new TradingError(`交易所 ${exchangeName} 未初始化`, 'EXCHANGE_NOT_FOUND', exchangeName);
        }
        
        return await exchange.placeOrder(orderParams);
    }

    /**
     * 添加套利策略
     */
    addArbitrageStrategy(strategy) {
        const id = strategy.id || `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullStrategy = {
            id,
            ...strategy,
            enabled: strategy.enabled !== false,
            createdAt: Date.now(),
            lastTriggered: null,
            totalTriggers: 0
        };
        
        this.strategies.arbitrage.set(id, fullStrategy);
        
        // 訂閱相關的價格數據
        this.subscribeToSymbols(fullStrategy);
        
        logger.info(`添加套利策略 ${id}`);
        this.emit('strategyAdded', fullStrategy);
        
        return fullStrategy;
    }

    /**
     * 訂閱交易對
     */
    async subscribeToSymbols(strategy) {
        const symbols = [];
        
        if (strategy.leg1) {
            symbols.push({
                exchange: strategy.leg1.exchange,
                symbol: strategy.leg1.symbol,
                category: strategy.leg1.type
            });
        }
        
        if (strategy.leg2) {
            symbols.push({
                exchange: strategy.leg2.exchange,
                symbol: strategy.leg2.symbol,
                category: strategy.leg2.type
            });
        }
        
        for (const item of symbols) {
            const exchange = this.exchanges.get(item.exchange);
            if (exchange) {
                await exchange.subscribeToTickers([item]);
            }
        }
    }

    /**
     * 更新指標
     */
    updateMetrics() {
        const now = Date.now();
        const timeDiff = now - this.metrics.lastUpdateTime;
        
        // 計算平均價差
        if (this.metrics.totalOpportunities > 0) {
            // 這裡可以加入更複雜的計算邏輯
        }
        
        this.metrics.lastUpdateTime = now;
        
        // 發送指標更新事件
        this.emit('metricsUpdated', this.metrics);
    }

    /**
     * 設置錯誤處理
     */
    setupErrorHandlers() {
        this.on('error', (error) => {
            logger.error('引擎錯誤:', error);
            
            // 如果是嚴重錯誤，啟動緊急停止
            if (this.isCriticalError(error)) {
                this.emergencyStop();
            }
        });
    }

    /**
     * 判斷是否為嚴重錯誤
     */
    isCriticalError(error) {
        const criticalCodes = ['INSUFFICIENT_BALANCE', 'API_KEY_INVALID', 'RATE_LIMIT_EXCEEDED'];
        return criticalCodes.includes(error.code);
    }

    /**
     * 緊急停止
     */
    emergencyStop() {
        logger.warn('啟動緊急停止程序');
        this.config.emergencyStop = true;
        this.stopScanning();
        this.emit('emergencyStop');
    }

    /**
     * 設置性能監控
     */
    setupMetricsCollection() {
        // 每分鐘記錄一次指標
        setInterval(() => {
            logger.info('性能指標:', this.metrics);
        }, 60000);
    }

    /**
     * 處理價格更新
     */
    handleTickerUpdate(data) {
        // 實時價格更新處理
        this.emit('priceUpdate', data);
    }

    /**
     * 處理訂單簿更新
     */
    handleOrderBookUpdate(data) {
        // 訂單簿更新處理
        this.emit('orderbookUpdate', data);
    }

    /**
     * 處理持倉更新
     */
    handlePositionUpdate(data) {
        // 持倉更新處理
        this.emit('positionUpdate', data);
    }

    /**
     * 獲取狀態
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            metrics: this.metrics,
            strategies: {
                arbitrage: Array.from(this.strategies.arbitrage.values()),
                twap: Array.from(this.strategies.twap.values())
            },
            exchanges: Array.from(this.exchanges.keys()).map(name => ({
                name,
                connected: this.exchanges.get(name).isExchangeConnected()
            })),
            activeTrades: this.activeTrades.size
        };
    }

    /**
     * 清理資源
     */
    async cleanup() {
        logger.info('清理套利引擎資源...');
        
        // 停止掃描
        this.stopScanning();
        
        // 清理交易所連接
        for (const [name, exchange] of this.exchanges) {
            await exchange.cleanup();
        }
        
        // 清理策略
        this.strategies.arbitrage.clear();
        this.strategies.twap.clear();
        
        this.isRunning = false;
        logger.info('套利引擎資源清理完成');
    }
}

module.exports = ImprovedArbitrageEngine;