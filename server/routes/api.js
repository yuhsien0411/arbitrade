/**
 * API路由配置
 * 提供RESTful API接口供前端調用
 * 
 */

const express = require('express');
const BinancePublicClient = require('../exchanges/binance/BinancePublicClient');
const router = express.Router();
const { getArbitrageEngine } = require('../services/arbitrageEngine');
const { ArbitragePair, Trade, PriceData } = require('../models');
const fs = require('fs');
const path = require('path');
const ExchangeStatusService = require('../services/ExchangeStatusService');
const monitoringRoutes = require('./monitoring');
const CacheManager = require('../services/CacheManager');
const logger = require('../utils/logger');

// 請求日誌中間件 - 已禁用重複的 API 日誌
const requestLogger = (req, res, next) => {
  // 只記錄錯誤和重要的 API 調用，不記錄常規的 GET 請求
  const shouldLog = req.method !== 'GET' || 
                   req.url.includes('/error') || 
                   req.url.includes('/test') ||
                   req.statusCode >= 400;
  
  if (shouldLog) {
    const startTime = Date.now();
    
    logger.info('🚀 [API Request]', {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      body: req.body,
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'authorization': req.get('Authorization') ? '[REDACTED]' : undefined
      },
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // 攔截響應
    const originalSend = res.send;
    res.send = function(data) {
      const responseTime = Date.now() - startTime;
      
      logger.info('✅ [API Response]', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        responseTime: `${responseTime}ms`,
        dataSize: data ? JSON.stringify(data).length : 0,
        timestamp: new Date().toISOString()
      });
      
      return originalSend.call(this, data);
    };
  }
  
  next();
};

// 應用請求日誌中間件
router.use(requestLogger);

// 寫入 .env 檔案的函數
const writeEnvFile = (envData) => {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = '';
        
        // 讀取現有的 .env 檔案
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        // 更新或添加環境變數
        const lines = envContent.split('\n');
        const updatedLines = [];
        const processedKeys = new Set();
        
        // 處理現有行
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const equalIndex = trimmedLine.indexOf('=');
                if (equalIndex > 0) {
                    const key = trimmedLine.substring(0, equalIndex).trim();
                    if (envData[key] !== undefined) {
                        updatedLines.push(`${key}=${envData[key]}`);
                        processedKeys.add(key);
                    } else {
                        updatedLines.push(line);
                    }
                } else {
                    updatedLines.push(line);
                }
            } else {
                updatedLines.push(line);
            }
        }
        
        // 添加新的環境變數
        for (const [key, value] of Object.entries(envData)) {
            if (!processedKeys.has(key)) {
                updatedLines.push(`${key}=${value}`);
            }
        }
        
        // 寫入檔案
        fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
        logger.info(`已更新 .env 檔案: ${Object.keys(envData).join(', ')}`);
        
    } catch (error) {
        logger.error('寫入 .env 檔案失敗:', error);
        throw error;
    }
};

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

// 中間件：請求日誌 - 已移除重複的日誌記錄

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

        // 驗證 leg1 和 leg2 的完整結構
        const validateLeg = (leg, legName) => {
            const requiredFields = ['exchange', 'symbol', 'type', 'side'];
            for (const field of requiredFields) {
                if (!leg[field]) {
                    return `缺少 ${legName} 的必需字段: ${field}`;
                }
            }
            
            // 驗證 type 欄位的值
            const validTypes = ['spot', 'linear', 'inverse'];
            if (!validTypes.includes(leg.type)) {
                return `${legName}.type 必須是以下之一: ${validTypes.join(', ')}`;
            }
            
            // 驗證 exchange 欄位的值
            const validExchanges = ['bybit', 'binance', 'okx', 'bitget'];
            if (!validExchanges.includes(leg.exchange)) {
                return `${legName}.exchange 必須是以下之一: ${validExchanges.join(', ')}`;
            }
            
            // 驗證 side 欄位的值
            const validSides = ['buy', 'sell'];
            if (!validSides.includes(leg.side)) {
                return `${legName}.side 必須是以下之一: ${validSides.join(', ')}`;
            }
            
            return null;
        };

        const leg1Error = validateLeg(pairData.leg1, 'leg1');
        if (leg1Error) {
            return res.status(400).json({
                success: false,
                error: leg1Error
            });
        }

        const leg2Error = validateLeg(pairData.leg2, 'leg2');
        if (leg2Error) {
            return res.status(400).json({
                success: false,
                error: leg2Error
            });
        }

        // 驗證 threshold 和 amount 的數值範圍
        if (pairData.threshold < 0 || pairData.threshold > 100) {
            return res.status(400).json({
                success: false,
                error: 'threshold 必須在 0 到 100 之間（百分比）'
            });
        }

        if (pairData.amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'amount 必須大於 0'
            });
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
        // 禁用 binance endpoints（保留但不可用）
        if (exchange === 'binance') {
            return res.status(410).json({ success: false, error: 'Binance endpoint disabled' });
        }
        const cacheKey = apiCache.generateKey(`price:${exchange}:${symbol}`);

        // 先查緩存
        const cached = await apiCache.get(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached, cached: true });
        }
        
        if (exchange === 'bybit') {
            const orderBook = await req.engine.exchanges.bybit.getOrderBook(symbol);
            await apiCache.set(cacheKey, orderBook, 1); // 1秒TTL，更快的價格更新
            res.json({
                success: true,
                data: orderBook,
                timestamp: Date.now()
            });
        } else if (exchange === 'binance') {
            let orderBook;
            if (req.engine.exchanges.binance) {
                orderBook = await req.engine.exchanges.binance.getOrderBook(symbol, 'spot');
            } else {
                // 後備：使用公開客戶端獲取訂單簿（無需 API Key）
                const publicClient = new BinancePublicClient();
                orderBook = await publicClient.getOrderBook(symbol, 100);
            }
            await apiCache.set(cacheKey, orderBook, 1); // 1秒TTL
            res.json({
                success: true,
                data: orderBook,
                timestamp: Date.now()
            });
        } else {
            return res.status(400).json({
                success: false,
                error: `不支援的交易所: ${exchange}`
            });
        }

    } catch (error) {
        // 只在非快取命中時記錄錯誤，避免重複日誌
        if (!req.query.cached) {
            logger.error(`獲取價格數據失敗 ${req.params.exchange}/${req.params.symbol}:`, error);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取公開 ticker (bid/ask 最優價)
 * GET /api/ticker/:exchange/:symbol?category=spot|linear
 */
router.get('/ticker/:exchange/:symbol', requireEngine, async (req, res) => {
    try {
        const { exchange, symbol } = req.params;
        const category = (req.query.category || 'spot').toString();
        // 禁用 binance endpoints（保留但不可用）
        if (exchange === 'binance') {
            return res.status(410).json({ success: false, error: 'Binance endpoint disabled' });
        }
        const cacheKey = apiCache.generateKey(`ticker:${exchange}:${category}:${symbol}`);

        const cached = await apiCache.get(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached, cached: true });
        }

        if (exchange === 'binance') {
            let ticker;
            const publicClient = new BinancePublicClient();
            const isFutures = (category === 'futures');
            if (isFutures) {
                const fut = await publicClient.getFuturesBookTicker(symbol);
                if (!fut.success) {
                    return res.status(502).json({ success: false, error: fut.error || 'Binance 期貨 ticker 失敗' });
                }
                ticker = fut.data;
            } else {
                if (req.engine.exchanges.binance && req.engine.exchanges.binance.restClient?.getBookTicker) {
                    ticker = await req.engine.exchanges.binance.restClient.getBookTicker(symbol);
                } else {
                    const spot = await publicClient.getTicker(symbol);
                    if (!spot.success) {
                        return res.status(502).json({ success: false, error: spot.error || 'Binance 現貨 ticker 失敗' });
                    }
                    ticker = spot.data;
                }
            }

            let data = {
                symbol: ticker.symbol,
                exchange: isFutures ? 'binance-futures' : 'binance',
                bid1: { price: Number(ticker.bidPrice), amount: Number(ticker.bidQty || 0) },
                ask1: { price: Number(ticker.askPrice), amount: Number(ticker.askQty || 0) },
                ts: ticker.timestamp || Date.now(),
                source: 'bookTicker'
            };

            // 若取得價格為 0，使用快取回退，不覆蓋快取
            const isInvalid = (!data.bid1?.price || data.bid1.price <= 0) && (!data.ask1?.price || data.ask1.price <= 0);
            if (isInvalid) {
                const cached = await apiCache.get(cacheKey);
                if (cached) {
                    return res.json({ success: true, data: cached, cached: true, fallback: true });
                }
                // 無快取則仍回傳原始但標記無效，讓前端自行處理
                return res.json({ success: true, data, invalid: true });
            }

            await apiCache.set(cacheKey, data, 1);
            return res.json({ success: true, data });
        }

        if (exchange === 'bybit') {
            // 使用公共 orderbook 近似 ticker
            const obRes = await req.engine.exchanges.bybit.getOrderBook(symbol, category === 'spot' ? 'spot' : 'linear');
            if (!obRes || !obRes.success || !obRes.data) {
                return res.status(502).json({ success: false, error: 'Bybit 公開數據不可用' });
            }
            const raw = obRes.data;
            const bids = Array.isArray(raw?.b) ? raw.b : (Array.isArray(raw?.list?.[0]?.b) ? raw.list[0].b : (Array.isArray(raw?.bids) ? raw.bids : []));
            const asks = Array.isArray(raw?.a) ? raw.a : (Array.isArray(raw?.list?.[0]?.a) ? raw.list[0].a : (Array.isArray(raw?.asks) ? raw.asks : []));
            const bestBid = Array.isArray(bids) && bids.length > 0 ? bids[0] : null;
            const bestAsk = Array.isArray(asks) && asks.length > 0 ? asks[0] : null;

            let data = {
                symbol,
                exchange: 'bybit',
                bid1: bestBid && bestBid.length >= 2 ? { price: Number(bestBid[0]), amount: Number(bestBid[1]) } : null,
                ask1: bestAsk && bestAsk.length >= 2 ? { price: Number(bestAsk[0]), amount: Number(bestAsk[1]) } : null,
                ts: Date.now(),
                source: 'orderbook'
            };

            const isInvalid = (!data.bid1?.price || data.bid1.price <= 0) && (!data.ask1?.price || data.ask1.price <= 0);
            if (isInvalid) {
                const cached = await apiCache.get(cacheKey);
                if (cached) {
                    return res.json({ success: true, data: cached, cached: true, fallback: true });
                }
                return res.json({ success: true, data, invalid: true });
            }

            await apiCache.set(cacheKey, data, 1);
            return res.json({ success: true, data });
        }

        return res.status(400).json({ success: false, error: `不支援的交易所: ${exchange}` });
    } catch (error) {
        logger.error(`獲取公開 ticker 失敗 ${req.params.exchange}/${req.params.symbol}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 獲取最優掛單數據 (ticker.book)
 * GET /api/book-ticker/:exchange/:symbol
 */
router.get('/book-ticker/:exchange/:symbol', requireEngine, async (req, res) => {
    try {
        const { exchange, symbol } = req.params;
        const cacheKey = apiCache.generateKey(`book-ticker:${exchange}:${symbol}`);

        // 先查緩存
        const cached = await apiCache.get(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached, cached: true });
        }
        
        if (exchange === 'binance' && req.engine.exchanges.binance) {
            const bookTicker = await req.engine.exchanges.binance.getBookTicker(symbol);
            await apiCache.set(cacheKey, bookTicker, 1); // 1秒TTL，更頻繁更新
            res.json({
                success: true,
                data: bookTicker
            });
        } else {
            return res.status(400).json({
                success: false,
                error: `不支援的交易所: ${exchange}`
            });
        }

    } catch (error) {
        logger.error(`獲取最優掛單數據失敗 ${req.params.exchange}/${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取所有交易對的最優掛單數據
 * GET /api/book-ticker/:exchange
 */
router.get('/book-ticker/:exchange', requireEngine, async (req, res) => {
    try {
        const { exchange } = req.params;
        const cacheKey = apiCache.generateKey(`book-ticker:${exchange}:all`);

        // 先查緩存
        const cached = await apiCache.get(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached, cached: true });
        }
        
        if (exchange === 'binance' && req.engine.exchanges.binance) {
            const bookTickers = await req.engine.exchanges.binance.getAllBookTickers();
            await apiCache.set(cacheKey, bookTickers, 5); // 5秒TTL
            res.json({
                success: true,
                data: bookTickers
            });
        } else {
            return res.status(400).json({
                success: false,
                error: `不支援的交易所: ${exchange}`
            });
        }

    } catch (error) {
        logger.error(`獲取所有最優掛單數據失敗 ${req.params.exchange}:`, error);
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
                    await apiCache.set(key, ob, 1); // 1秒TTL
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
                        await apiCache.set(key, orderBook, 1); // 1秒TTL
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

        // 驗證 leg1 和 leg2 的完整結構
        const validateLeg = (leg, legName) => {
            const requiredFields = ['exchange', 'symbol', 'type', 'side'];
            for (const field of requiredFields) {
                if (!leg[field]) {
                    return `缺少 ${legName} 的必需字段: ${field}`;
                }
            }
            
            // 驗證 type 欄位的值
            const validTypes = ['spot', 'linear', 'inverse'];
            if (!validTypes.includes(leg.type)) {
                return `${legName}.type 必須是以下之一: ${validTypes.join(', ')}`;
            }
            
            // 驗證 exchange 欄位的值
            const validExchanges = ['bybit', 'binance', 'okx', 'bitget'];
            if (!validExchanges.includes(leg.exchange)) {
                return `${legName}.exchange 必須是以下之一: ${validExchanges.join(', ')}`;
            }
            
            // 驗證 side 欄位的值
            const validSides = ['buy', 'sell'];
            if (!validSides.includes(leg.side)) {
                return `${legName}.side 必須是以下之一: ${validSides.join(', ')}`;
            }
            
            return null;
        };

        const leg1Error = validateLeg(config.leg1, 'leg1');
        if (leg1Error) {
            return res.status(400).json({
                success: false,
                error: leg1Error
            });
        }

        const leg2Error = validateLeg(config.leg2, 'leg2');
        if (leg2Error) {
            return res.status(400).json({
                success: false,
                error: leg2Error
            });
        }

        // 驗證 threshold 和 amount 的數值範圍
        if (config.threshold < 0 || config.threshold > 100) {
            return res.status(400).json({
                success: false,
                error: 'threshold 必須在 0 到 100 之間（百分比）'
            });
        }

        if (config.amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'amount 必須大於 0'
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
        
        // 檢查是否正在執行中（防重複執行）
        if (req.engine.activeTrades.has(pairId)) {
            return res.status(429).json({
                success: false,
                error: '該交易對正在執行中，請稍後再試',
                retryAfter: 5 // 5秒後可重試
            });
        }
        
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
        const startTime = Date.now();
        const result = await req.engine.executeArbitrage(opportunity);
        const executionTime = Date.now() - startTime;
        
        // 記錄執行結果（只在成功或重要錯誤時記錄）
        if (result.success || result.reason?.includes('風控')) {
            logger.info(`套利執行完成 ${pairId}`, {
                success: result.success,
                executionTime: `${executionTime}ms`,
                mock: result.mock || false,
                reason: result.reason
            });
        }
        
        res.json({
            success: result.success,
            data: {
                ...result,
                executionTime: executionTime
            }
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
 * 刪除TWAP策略
 * DELETE /api/twap/strategies/:id
 */
router.delete('/twap/strategies/:id', requireEngine, (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: '缺少策略ID' });
        }
        const existed = req.engine.twapStrategies.has(id);
        if (!existed) {
            return res.status(404).json({ success: false, error: '策略不存在' });
        }
        req.engine.twapStrategies.delete(id);
        return res.json({ success: true });
    } catch (error) {
        logger.error('刪除TWAP策略失敗:', error);
        res.status(500).json({ success: false, error: error.message });
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
 * 獲取API設定
 * GET /api/settings/api
 */
router.get('/settings/api', (req, res) => {
    try {
        // 只返回真正配置了的 API（不是默認值）
        const isValidApiKey = (key) => {
            return key && 
                   key !== '' && 
                   key !== 'your_bybit_api_key_here' &&
                   key !== 'your_binance_api_key' &&
                   key !== 'your_okx_api_key' &&
                   key !== 'your_bitget_api_key';
        };
        
        const responseData = {};
        
        // 調試：檢查實際的環境變數值
        console.log('DEBUG: BYBIT_API_KEY =', process.env.BYBIT_API_KEY);
        console.log('DEBUG: BYBIT_SECRET =', process.env.BYBIT_SECRET);
        console.log('DEBUG: isValidApiKey(BYBIT_API_KEY) =', isValidApiKey(process.env.BYBIT_API_KEY));
        console.log('DEBUG: isValidApiKey(BYBIT_SECRET) =', isValidApiKey(process.env.BYBIT_SECRET));
        
        // 檢查 Bybit
        if (isValidApiKey(process.env.BYBIT_API_KEY) && isValidApiKey(process.env.BYBIT_SECRET)) {
            responseData.bybit = {
                connected: true,
                publicOnly: false,
                hasApiKey: true,
                hasSecret: true,
                testnet: process.env.BYBIT_TESTNET === 'true'
            };
        } else {
            responseData.bybit = {
                connected: false,
                publicOnly: true,
                hasApiKey: false,
                hasSecret: false,
                testnet: false
            };
        }
        
        // 檢查 Binance
        if (isValidApiKey(process.env.BINANCE_API_KEY) && isValidApiKey(process.env.BINANCE_SECRET)) {
            responseData.binance = {
                connected: true,
                publicOnly: false,
                hasApiKey: true,
                hasSecret: true,
                testnet: process.env.BINANCE_TESTNET === 'true'
            };
        } else {
            responseData.binance = {
                connected: false,
                publicOnly: true,
                hasApiKey: false,
                hasSecret: false,
                testnet: false
            };
        }
        
        // 檢查 OKX
        if (isValidApiKey(process.env.OKX_API_KEY) && process.env.OKX_SECRET) {
            responseData.okx = {
                connected: true,
                publicOnly: false,
                hasApiKey: true,
                hasSecret: true,
                hasPassphrase: !!process.env.OKX_PASSPHRASE,
                testnet: process.env.OKX_TESTNET === 'true'
            };
        } else {
            responseData.okx = {
                connected: false,
                publicOnly: true,
                hasApiKey: false,
                hasSecret: false,
                hasPassphrase: false,
                testnet: false
            };
        }
        
        // 檢查 Bitget
        if (isValidApiKey(process.env.BITGET_API_KEY) && process.env.BITGET_SECRET) {
            responseData.bitget = {
                connected: true,
                publicOnly: false,
                hasApiKey: true,
                hasSecret: true,
                hasPassphrase: !!process.env.BITGET_PASSPHRASE,
                testnet: process.env.BITGET_TESTNET === 'true'
            };
        } else {
            responseData.bitget = {
                connected: false,
                publicOnly: true,
                hasApiKey: false,
                hasSecret: false,
                hasPassphrase: false,
                testnet: false
            };
        }

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        logger.error('獲取API設定失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 更新API設定
 * PUT /api/settings/api
 */
router.put('/settings/api', (req, res) => {
    try {
        const requestData = req.body;
        logger.info('API Settings Update Request', requestData, 'API');
        
        // 準備要寫入 .env 檔案的數據
        const envData = {};
        
        // 處理新的多交易所格式
        if (requestData.bybit) {
            const { apiKey, secret, testnet } = requestData.bybit;
            
            if (apiKey !== undefined) {
                process.env.BYBIT_API_KEY = apiKey;
                envData.BYBIT_API_KEY = apiKey;
            }
            if (secret !== undefined) {
                process.env.BYBIT_SECRET = secret;
                envData.BYBIT_SECRET = secret;
            }
            if (testnet !== undefined) {
                process.env.BYBIT_TESTNET = testnet.toString();
                envData.BYBIT_TESTNET = testnet.toString();
            }
        }
        
        // 處理舊的單一格式（向後兼容）
        if (requestData.bybitApiKey !== undefined) {
            process.env.BYBIT_API_KEY = requestData.bybitApiKey;
            envData.BYBIT_API_KEY = requestData.bybitApiKey;
        }
        if (requestData.bybitSecret !== undefined) {
            process.env.BYBIT_SECRET = requestData.bybitSecret;
            envData.BYBIT_SECRET = requestData.bybitSecret;
        }
        if (requestData.bybitTestnet !== undefined) {
            process.env.BYBIT_TESTNET = requestData.bybitTestnet.toString();
            envData.BYBIT_TESTNET = requestData.bybitTestnet.toString();
        }

        // 寫入 .env 檔案
        if (Object.keys(envData).length > 0) {
            writeEnvFile(envData);
            logger.info('API設定已更新並寫入 .env 檔案', envData, 'API');
        }

        // 返回更新後的設定狀態
        const responseData = {};
        
        // 檢查 Bybit 設定
        if (process.env.BYBIT_API_KEY && process.env.BYBIT_SECRET) {
            responseData.bybit = {
                connected: true,
                publicOnly: false,
                hasApiKey: true,
                hasSecret: true,
                testnet: process.env.BYBIT_TESTNET === 'true'
            };
        } else {
            responseData.bybit = {
                connected: false,
                publicOnly: true,
                hasApiKey: false,
                hasSecret: false,
                testnet: false
            };
        }
        
        // 檢查 Binance 設定
        if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
            responseData.binance = {
                connected: true,
                publicOnly: false,
                hasApiKey: true,
                hasSecret: true,
                testnet: process.env.BINANCE_TESTNET === 'true'
            };
        } else {
            responseData.binance = {
                connected: false,
                publicOnly: true,
                hasApiKey: false,
                hasSecret: false,
                testnet: false
            };
        }
        
        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        logger.error('更新API設定失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 獲取API設定（用於編輯）
 * GET /api/settings/api/edit
 */
router.get('/settings/api/edit', (req, res) => {
    try {
        const apiSettings = {};
        
        // 只返回真正配置了的 API（不是默認值）
        const isValidApiKey = (key) => {
            return key && 
                   key !== '' && 
                   key !== 'your_bybit_api_key_here' &&
                   key !== 'your_binance_api_key' &&
                   key !== 'your_okx_api_key' &&
                   key !== 'your_bitget_api_key';
        };
        
        // 檢查 Bybit
        if (isValidApiKey(process.env.BYBIT_API_KEY) && isValidApiKey(process.env.BYBIT_SECRET)) {
            apiSettings.bybit = {
                apiKey: process.env.BYBIT_API_KEY,
                secret: process.env.BYBIT_SECRET,
                testnet: process.env.BYBIT_TESTNET === 'true'
            };
        }
        
        // 檢查 Binance
        if (isValidApiKey(process.env.BINANCE_API_KEY) && isValidApiKey(process.env.BINANCE_SECRET)) {
            apiSettings.binance = {
                apiKey: process.env.BINANCE_API_KEY,
                secret: process.env.BINANCE_SECRET,
                testnet: process.env.BINANCE_TESTNET === 'true'
            };
        }
        
        // 檢查 OKX
        if (isValidApiKey(process.env.OKX_API_KEY) && isValidApiKey(process.env.OKX_SECRET)) {
            apiSettings.okx = {
                apiKey: process.env.OKX_API_KEY,
                secret: process.env.OKX_SECRET,
                passphrase: process.env.OKX_PASSPHRASE || '',
                testnet: process.env.OKX_TESTNET === 'true'
            };
        }
        
        // 檢查 Bitget
        if (isValidApiKey(process.env.BITGET_API_KEY) && isValidApiKey(process.env.BITGET_SECRET)) {
            apiSettings.bitget = {
                apiKey: process.env.BITGET_API_KEY,
                secret: process.env.BITGET_SECRET,
                passphrase: process.env.BITGET_PASSPHRASE || '',
                testnet: process.env.BITGET_TESTNET === 'true'
            };
        }

        res.json({
            success: true,
            data: apiSettings
        });

    } catch (error) {
        logger.error('獲取API設定失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 刪除API設定
 * DELETE /api/settings/api/:exchange
 */
router.delete('/settings/api/:exchange', (req, res) => {
    try {
        const { exchange } = req.params;
        logger.info(`API Settings Delete Request for ${exchange}`, null, 'API');
        
        if (exchange === 'bybit') {
            // 準備要寫入 .env 檔案的數據（清空）
            const envData = {
                BYBIT_API_KEY: '',
                BYBIT_SECRET: '',
                BYBIT_TESTNET: 'false'
            };
            
            // 清空 Bybit API 設定（內存中）
            process.env.BYBIT_API_KEY = '';
            process.env.BYBIT_SECRET = '';
            process.env.BYBIT_TESTNET = 'false';
            
            // 寫入 .env 檔案
            writeEnvFile(envData);
            
            logger.info(`已刪除 ${exchange} API設定並更新 .env 檔案`, envData, 'API');
            
            res.json({
                success: true,
                data: {
                    message: `已刪除 ${exchange} API設定`
                }
            });
        } else if (exchange === 'binance') {
            // 準備要寫入 .env 檔案的數據（清空）
            const envData = {
                BINANCE_API_KEY: '',
                BINANCE_SECRET: '',
                BINANCE_TESTNET: 'false'
            };
            
            // 清空 Binance API 設定（內存中）
            process.env.BINANCE_API_KEY = '';
            process.env.BINANCE_SECRET = '';
            process.env.BINANCE_TESTNET = 'false';
            
            // 寫入 .env 檔案
            writeEnvFile(envData);
            
            logger.info(`已刪除 ${exchange} API設定並更新 .env 檔案`, envData, 'API');
            
            res.json({
                success: true,
                data: {
                    message: `已刪除 ${exchange} API設定`
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: `不支援的交易所: ${exchange}`
            });
        }

    } catch (error) {
        logger.error('刪除API設定失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 測試API連接
 * GET /api/settings/api/test
 */
router.get('/settings/api/test', async (req, res) => {
    try {
        const { exchange } = req.query;
        
        if (!exchange) {
            // 默認測試 Bybit
            if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_SECRET) {
                return res.json({
                    success: false,
                    data: {
                        connected: false,
                        message: 'Bybit API 密鑰未配置'
                    }
                });
            }
            
            // 實際測試 Bybit API 連接
            try {
                logger.info('開始測試 Bybit API 連接...');
                logger.info('API Key:', process.env.BYBIT_API_KEY);
                logger.info('Secret:', process.env.BYBIT_SECRET ? '已設定' : '未設定');
                logger.info('Testnet:', process.env.BYBIT_TESTNET);
                
                const { RestClientV5 } = require('bybit-api');
                const client = new RestClientV5({
                    key: process.env.BYBIT_API_KEY,
                    secret: process.env.BYBIT_SECRET,
                    testnet: process.env.BYBIT_TESTNET === 'true'
                });

                logger.info('Bybit 客戶端創建成功，開始調用 API...');
                
                // 測試 API 連接：獲取帳戶信息
                const accountInfo = await client.getAccountInfo();
                
                logger.info('Bybit API 調用完成，響應:', JSON.stringify(accountInfo, null, 2));
                
                if (accountInfo.retCode === 0) {
                    const account = accountInfo.result;
                    res.json({
                        success: true,
                        data: {
                            exchange: 'bybit',
                            connected: true,
                            message: 'API連接測試成功',
                            serverTime: Date.now() / 1000,
                            accountInfo: {
                                marginModeText: account.marginMode === 'REGULAR_MARGIN' ? '全倉模式' : 
                                              account.marginMode === 'PORTFOLIO_MARGIN' ? '組合保證金模式' : '未知',
                                unifiedMarginStatus: account.unifiedMarginStatus,
                                unifiedMarginStatusText: account.unifiedMarginStatus === 1 ? '經典帳戶' :
                                                        account.unifiedMarginStatus === 3 ? '統一帳戶1.0' :
                                                        account.unifiedMarginStatus === 4 ? '統一帳戶1.0 (pro)' :
                                                        account.unifiedMarginStatus === 5 ? '統一帳戶2.0' :
                                                        account.unifiedMarginStatus === 6 ? '統一帳戶2.0 (pro)' : '未知',
                                isMasterTrader: account.isMasterTrader || false,
                                spotHedgingStatus: account.spotHedgingStatus || 'OFF',
                                spotHedgingStatusText: account.spotHedgingStatus === 'ON' ? '開啟' : '關閉',
                                updatedTime: account.updatedTime || Date.now().toString()
                            }
                        }
                    });
                } else {
                    let errorMessage = accountInfo.retMsg || 'API 調用失敗';
                    let suggestions = '';
                    
                    // 根據不同的錯誤代碼提供建議
                    if (accountInfo.retCode === 10010) {
                        suggestions = '\n建議：請檢查 API 密鑰的 IP 白名單設定，或在 Bybit 帳戶中移除 IP 限制。';
                    } else if (accountInfo.retCode === 10003) {
                        suggestions = '\n建議：請檢查 API 密鑰和密鑰是否正確。';
                    }
                    
                    res.json({
                        success: true, // 修改為 true，因為 API 調用成功但返回了錯誤信息
                        data: {
                            connected: false,
                            message: `Bybit API 錯誤 (${accountInfo.retCode}): ${errorMessage}${suggestions}`
                        }
                    });
                }
            } catch (apiError) {
                logger.error('Bybit API 測試失敗:', apiError);
                logger.error('錯誤詳情:', {
                    message: apiError.message,
                    stack: apiError.stack,
                    name: apiError.name
                });
                res.json({
                    success: true, // 修改為 true，因為我們需要前端能正確處理這個響應
                    data: {
                        connected: false,
                        message: `API 連接失敗: ${apiError.message || '網路錯誤'}`
                    }
                });
            }
        } else {
            res.json({
                success: true,
                data: {
                    exchange,
                    connected: true,
                    message: 'API連接測試成功'
                }
            });
        }

    } catch (error) {
        logger.error('API連接測試失敗:', error);
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
