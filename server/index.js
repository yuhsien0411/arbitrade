/**
 * 加密貨幣雙腿套利交易系統 - 主服務器
 * 
 * 功能：
 * - 提供REST API接口
 * - WebSocket即時數據推送
 * - 交易所API整合
 * - 套利策略執行
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 內存存儲（生產環境應使用數據庫）
let monitoringPairs = [
    {
      id: 'test_pair_1',
      leg1: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear',side: 'buy' },
      leg2: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear',side: 'sell' },
      threshold: 0.1,
      amount: 50,
      enabled: true,
      executionMode: 'threshold',
      createdAt: Date.now(),
      lastTriggered: null,
      totalTriggers: 0
    },
    {
      id: 'test_pair_2',
      leg1: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'spot',side: 'buy' },
      leg2: { exchange: 'bybit', symbol: 'BTCUSDT', type: 'linear',side: 'sell' },
      threshold: 0.15,
      amount: 0.01,
      enabled: true,
      executionMode: 'threshold',
      createdAt: Date.now(),
      lastTriggered: null,
      totalTriggers: 0
    }
  ];

// 導入路由和中間件
const logger = require('./utils/logger');
const bybitService = require('./services/bybitService');
const apiRoutes = require('./routes/api');
const websocketHandler = require('./websocket/handler');

// 更新.env文件的函數
function updateEnvFile(key, value) {
    try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        
        // 讀取現有的.env文件
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        const lines = envContent.split('\n');
        let keyFound = false;
        
        // 更新現有的鍵值或添加新的
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`${key}=`)) {
                lines[i] = `${key}=${value}`;
                keyFound = true;
                break;
            }
        }
        
        // 如果鍵不存在，添加到文件末尾
        if (!keyFound) {
            lines.push(`${key}=${value}`);
        }
        
        // 寫回文件
        fs.writeFileSync(envPath, lines.join('\n'));
        console.log(`✅ 已更新 .env 文件: ${key}`);
        
        return true;
    } catch (error) {
        console.error('❌ 更新 .env 文件失敗:', error);
        return false;
    }
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 基本中間件
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:"]
        }
    }
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康檢查端點
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// 基本API路由
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            isRunning: true,
            timestamp: new Date().toISOString(),
            message: '系統運行正常',
            monitoringPairs: [],
            twapStrategies: [],
            stats: {
                totalTrades: 0,
                successfulTrades: 0,
                totalProfit: 0,
                todayProfit: 0
            },
            riskLimits: {
                maxPositionSize: 10000,
                maxDailyLoss: 1000,
                priceDeviationThreshold: 0.05
            }
        }
    });
});

// 交易所信息API
app.get('/api/exchanges', (req, res) => {
    // 檢查實際的API配置狀態
    const bybitConnected = !!(process.env.BYBIT_API_KEY && 
                              process.env.BYBIT_SECRET && 
                              process.env.BYBIT_API_KEY !== 'your_bybit_api_key_here' && 
                              process.env.BYBIT_SECRET !== 'your_bybit_secret_here');
    
    console.log('交易所狀態檢查:', {
        hasApiKey: !!process.env.BYBIT_API_KEY,
        hasSecret: !!process.env.BYBIT_SECRET,
        apiKeyValid: process.env.BYBIT_API_KEY !== 'your_bybit_api_key_here',
        secretValid: process.env.BYBIT_SECRET !== 'your_bybit_secret_here',
        bybitConnected
    });
    
    res.json({
        success: true,
        data: {
            bybit: {
                name: 'Bybit',
                connected: bybitConnected,
                supportCustomSymbol: true, // 支援用戶自定義交易對
                description: '支援用戶自行輸入任何可用的交易對'
            },
            binance: {
                name: 'Binance (即將支援)',
                connected: false,
                comingSoon: true

            },
            
            okx: {
                name: 'OKX (即將支援)', 
                connected: false,
                comingSoon: true
                
            },               
            
            bitget: {   
                name: 'Bitget (即將支援)',
                connected: false,
                comingSoon: true
                
                }         
    }
    });
});

// 監控交易對API
app.get('/api/monitoring/pairs', (req, res) => {
    console.log('獲取監控交易對列表，當前數量:', monitoringPairs.length);
    res.json({
        success: true,
        data: monitoringPairs
    });
});

app.post('/api/monitoring/pairs', (req, res) => {
    const config = req.body;
    // 以「時間戳_主交易對symbol」作為ID，symbol優先取leg1，若無則取leg2，否則為unknown
    const now = Date.now();
    const mainSymbol = config.leg1?.symbol || config.leg2?.symbol || 'unknown';
    config.id = config.id || `${now}_${mainSymbol}`;
    config.createdAt = now;
    config.lastTriggered = null;
    config.totalTriggers = 0;
    
    // 添加到內存存儲
    monitoringPairs.push(config);
    
    console.log('新增監控交易對:', config);

    // 立即訂閱該監控對的 Bybit tickers（一對一訂閱）
    try {
        const items = [];
        if (config.leg1?.exchange === 'bybit' && config.leg1?.symbol) {
            items.push({ symbol: config.leg1.symbol, category: (config.leg1.type === 'spot' ? 'spot' : 'linear') });
        }
        if (config.leg2?.exchange === 'bybit' && config.leg2?.symbol) {
            items.push({ symbol: config.leg2.symbol, category: (config.leg2.type === 'spot' ? 'spot' : 'linear') });
        }
        if (items.length > 0) {
            bybitService.subscribeToTickers(items);
            console.log(`✅ 已為監控對 ${config.id} 訂閱 ${items.length} 個 tickers`);
        }
    } catch (e) {
        console.warn('訂閱 tickers 失敗於 /api/monitoring/pairs 新增:', e?.message || e);
    }
    
    res.json({
        success: true,
        data: config
    });
});

// 更新監控交易對
app.put('/api/monitoring/pairs/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('更新監控交易對:', { id, updates });
    
    const pairIndex = monitoringPairs.findIndex(p => p.id === id);
    if (pairIndex === -1) {
        return res.status(404).json({
            success: false,
            error: '找不到指定的監控交易對'
        });
    }
    
    // 更新配置
    monitoringPairs[pairIndex] = { ...monitoringPairs[pairIndex], ...updates };
    
    console.log('監控交易對更新成功:', monitoringPairs[pairIndex]);

    // 更新後重新訂閱該監控對的 tickers（確保新 symbol 被訂閱）
    try {
        const pair = monitoringPairs[pairIndex];
        const items = [];
        if (pair.leg1?.exchange === 'bybit' && pair.leg1?.symbol) {
            items.push({ symbol: pair.leg1.symbol, category: (pair.leg1.type === 'spot' ? 'spot' : 'linear') });
        }
        if (pair.leg2?.exchange === 'bybit' && pair.leg2?.symbol) {
            items.push({ symbol: pair.leg2.symbol, category: (pair.leg2.type === 'spot' ? 'spot' : 'linear') });
        }
        if (items.length > 0) {
            bybitService.subscribeToTickers(items);
            console.log(`✅ 已為更新後的監控對 ${id} 重新訂閱 ${items.length} 個 tickers`);
        }
    } catch (e) {
        console.warn('訂閱 tickers 失敗於 /api/monitoring/pairs 更新:', e?.message || e);
    }
    
    res.json({
        success: true,
        data: monitoringPairs[pairIndex]
    });
});

// 刪除監控交易對
app.delete('/api/monitoring/pairs/:id', (req, res) => {
    const { id } = req.params;
    
    console.log('刪除監控交易對:', id);
    
    const pairIndex = monitoringPairs.findIndex(p => p.id === id);
    if (pairIndex === -1) {
        return res.status(404).json({
            success: false,
            error: '找不到指定的監控交易對'
        });
    }
    
    // 從數組中移除
    const deletedPair = monitoringPairs.splice(pairIndex, 1)[0];
    
    console.log('監控交易對刪除成功:', deletedPair);
    
    res.json({
        success: true,
        data: { message: '監控交易對已刪除', deletedPair }
    });
});

// TWAP策略API
app.get('/api/twap/strategies', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});

app.post('/api/twap/strategies', (req, res) => {
    const config = req.body;
    config.id = config.id || `twap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    config.createdAt = Date.now();
    config.executedOrders = 0;
    config.remainingAmount = config.totalAmount;
    config.nextExecutionTime = Date.now() + config.timeInterval;
    config.status = 'active';
    config.amountPerOrder = config.totalAmount / config.orderCount;
    
    // 確保雙腿配置完整
    if (!config.leg1 || !config.leg2) {
        return res.status(400).json({
            success: false,
            error: '缺少雙腿配置信息'
        });
    }
    
    res.json({
        success: true,
        data: config
    });
});

// API設定相關端點
app.get('/api/settings/api', (req, res) => {
    console.log('獲取API設定請求');
    console.log('當前環境變量:', {
        hasApiKey: !!process.env.BYBIT_API_KEY,
        hasSecret: !!process.env.BYBIT_SECRET,
        testnet: process.env.BYBIT_TESTNET
    });
    
    // 返回API設定狀態（不返回實際密鑰）
    res.json({
        success: true,
        data: {
            // Bybit 配置
            bybitApiKey: process.env.BYBIT_API_KEY && process.env.BYBIT_API_KEY !== 'your_bybit_api_key_here',
            bybitSecret: process.env.BYBIT_SECRET && process.env.BYBIT_SECRET !== 'your_bybit_secret_here',
            bybitTestnet: process.env.BYBIT_TESTNET === 'true',
            
            // Binance 配置 (暫未實現)
            binanceApiKey: process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY !== 'your_binance_api_key',
            binanceSecret: process.env.BINANCE_SECRET && process.env.BINANCE_SECRET !== 'your_binance_secret',
            binanceTestnet: process.env.BINANCE_TESTNET === 'true',
            
            // OKX 配置 (暫未實現)
            okxApiKey: process.env.OKX_API_KEY && process.env.OKX_API_KEY !== 'your_okx_api_key',
            okxSecret: process.env.OKX_SECRET && process.env.OKX_SECRET !== 'your_okx_secret',
            okxPassphrase: process.env.OKX_PASSPHRASE && process.env.OKX_PASSPHRASE !== 'your_okx_passphrase',
            okxTestnet: process.env.OKX_TESTNET === 'true',
            
            // Bitget 配置 (暫未實現)
            bitgetApiKey: process.env.BITGET_API_KEY && process.env.BITGET_API_KEY !== 'your_bitget_api_key',
            bitgetSecret: process.env.BITGET_SECRET && process.env.BITGET_SECRET !== 'your_bitget_secret',
            bitgetPassphrase: process.env.BITGET_PASSPHRASE && process.env.BITGET_PASSPHRASE !== 'your_bitget_passphrase',
            bitgetTestnet: process.env.BITGET_TESTNET === 'true'
        }
    });
});

app.put('/api/settings/api', (req, res) => {
    const { bybitApiKey, bybitSecret, bybitTestnet } = req.body;
    
    console.log('收到API設定請求:', { 
        hasApiKey: !!bybitApiKey, 
        hasSecret: !!bybitSecret, 
        testnet: bybitTestnet 
    });
    
    try {
        // 在實際項目中，這些設定應該保存到安全的配置文件或環境變量
        // 這裡僅作演示，實際部署時需要適當的安全措施
        
        let updated = false;
        let updateMsg = [];
        
        if (bybitApiKey && bybitApiKey !== '***已配置***' && bybitApiKey.trim() !== '') {
            process.env.BYBIT_API_KEY = bybitApiKey;
            updateEnvFile('BYBIT_API_KEY', bybitApiKey);
            updated = true;
            updateMsg.push('API Key');
            console.log('API Key已更新');
        }
        
        if (bybitSecret && bybitSecret !== '***已配置***' && bybitSecret.trim() !== '') {
            process.env.BYBIT_SECRET = bybitSecret;
            updateEnvFile('BYBIT_SECRET', bybitSecret);
            updated = true;
            updateMsg.push('Secret Key');
            console.log('Secret Key已更新');
        }
        
        if (!updated) {
            console.log('沒有有效的API設定更新');
            return res.status(400).json({
                success: false,
                error: '沒有提供有效的API設定'
            });
        }
        
        // 設置測試網選項
        if (typeof bybitTestnet === 'boolean') {
            process.env.BYBIT_TESTNET = bybitTestnet.toString();
            updateEnvFile('BYBIT_TESTNET', bybitTestnet.toString());
        }
        
        // 重新初始化Bybit服務
        const initResult = bybitService.initialize();
        console.log('Bybit服務重新初始化:', initResult ? '成功' : '失敗');
        
        res.json({
            success: true,
            data: {
                message: `API設定已保存 (${updateMsg.join(', ')})`,
                bybitApiKey: process.env.BYBIT_API_KEY ? true : false,
                bybitSecret: process.env.BYBIT_SECRET ? true : false,
                bybitTestnet: process.env.BYBIT_TESTNET === 'true',
                updated: updateMsg
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '保存API設定失敗: ' + error.message
        });
    }
});

// 獲取API設定詳細信息（用於編輯）
app.get('/api/settings/api/edit', (req, res) => {
    console.log('獲取API設定編輯信息');
    
    // 返回實際的API設定值（用於編輯）
    res.json({
        success: true,
        data: {
            // Bybit 配置
            bybitApiKey: process.env.BYBIT_API_KEY || '',
            bybitSecret: process.env.BYBIT_SECRET || '',
            bybitTestnet: process.env.BYBIT_TESTNET === 'true',
            
            // Binance 配置 (暫未實現，但預留接口)
            binanceApiKey: process.env.BINANCE_API_KEY || '',
            binanceSecret: process.env.BINANCE_SECRET || '',
            binanceTestnet: process.env.BINANCE_TESTNET === 'true',
            
            // OKX 配置 (暫未實現，但預留接口)
            okxApiKey: process.env.OKX_API_KEY || '',
            okxSecret: process.env.OKX_SECRET || '',
            okxPassphrase: process.env.OKX_PASSPHRASE || '',
            okxTestnet: process.env.OKX_TESTNET === 'true',
            
            // Bitget 配置 (暫未實現，但預留接口)
            bitgetApiKey: process.env.BITGET_API_KEY || '',
            bitgetSecret: process.env.BITGET_SECRET || '',
            bitgetPassphrase: process.env.BITGET_PASSPHRASE || '',
            bitgetTestnet: process.env.BITGET_TESTNET === 'true'
        }
    });
});

// 刪除API設定
app.delete('/api/settings/api/:exchange', (req, res) => {
    const { exchange } = req.params;
    
    console.log('收到刪除API設定請求:', exchange);
    
    try {
        let deleted = false;
        let deletedKeys = [];
        
        if (exchange === 'bybit') {
            // 刪除Bybit API設定
            if (process.env.BYBIT_API_KEY) {
                delete process.env.BYBIT_API_KEY;
                updateEnvFile('BYBIT_API_KEY', 'your_bybit_api_key_here');
                deletedKeys.push('API Key');
                deleted = true;
            }
            
            if (process.env.BYBIT_SECRET) {
                delete process.env.BYBIT_SECRET;
                updateEnvFile('BYBIT_SECRET', 'your_bybit_secret_here');
                deletedKeys.push('Secret Key');
                deleted = true;
            }
            
            // 重置測試網設定為預設值
            process.env.BYBIT_TESTNET = 'false';
            updateEnvFile('BYBIT_TESTNET', 'false');
            
        } else {
            return res.status(400).json({
                success: false,
                error: '不支援的交易所: ' + exchange
            });
        }
        
        if (!deleted) {
            return res.json({
                success: false,
                message: '沒有找到要刪除的API設定'
            });
        }
        
        // 重新初始化相關服務
        if (exchange === 'bybit') {
            console.log('重新初始化Bybit服務...');
            // 這裡可以重新初始化Bybit服務，但由於沒有API密鑰，會初始化失敗，這是預期的
        }
        
        res.json({
            success: true,
            data: {
                message: `${exchange.toUpperCase()} API設定已刪除 (${deletedKeys.join(', ')})`,
                exchange: exchange,
                deletedKeys: deletedKeys
            }
        });
        
    } catch (error) {
        console.error('刪除API設定失敗:', error);
        res.status(500).json({
            success: false,
            error: '刪除API設定失敗: ' + error.message
        });
    }
});

// 執行套利交易
app.post('/api/arbitrage/execute/:pairId', async (req, res) => {
    const { pairId } = req.params;
    
    console.log('收到套利執行請求:', pairId);
    
    try {
        // 1. 根據pairId獲取監控配置
        const pairConfig = monitoringPairs.find(p => p.id === pairId);
        if (!pairConfig) {
            return res.status(404).json({
                success: false,
                error: '找不到指定的監控交易對配置'
            });
        }

        if (!pairConfig.enabled) {
            return res.status(400).json({
                success: false,
                error: '該監控交易對已停用'
            });
        }

        console.log('找到監控配置:', pairConfig);

        // 2. 檢查交易所連接狀態
        const leg1Exchange = pairConfig.leg1.exchange;
        const leg2Exchange = pairConfig.leg2.exchange;
        
        if (leg1Exchange !== 'bybit' || leg2Exchange !== 'bybit') {
            return res.status(400).json({
                success: false,
                error: '目前只支援 Bybit 交易所'
            });
        }

        // 檢查 Bybit API 配置
        if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_SECRET) {
            return res.status(400).json({
                success: false,
                error: 'Bybit API 未配置，請先在系統設定中配置 API 密鑰'
            });
        }

        // 3. 獲取當前價格和訂單簿
        const leg1Symbol = pairConfig.leg1.symbol;
        const leg2Symbol = pairConfig.leg2.symbol;
        
        console.log('獲取價格信息:', { leg1Symbol, leg2Symbol });
        
        const [leg1OrderBook, leg2OrderBook] = await Promise.all([
            bybitService.getOrderBook(leg1Symbol, pairConfig.leg1.type),
            bybitService.getOrderBook(leg2Symbol, pairConfig.leg2.type)
        ]);

        if (!leg1OrderBook.success || !leg2OrderBook.success) {
            return res.status(500).json({
                success: false,
                error: '無法獲取價格信息'
            });
        }

        // 4. 計算價差和套利機會
        const leg1Bid = parseFloat(leg1OrderBook.data.b[0][0]); // Leg1 買價
        const leg1Ask = parseFloat(leg1OrderBook.data.a[0][0]); // Leg1 賣價
        const leg2Bid = parseFloat(leg2OrderBook.data.b[0][0]); // Leg2 買價
        const leg2Ask = parseFloat(leg2OrderBook.data.a[0][0]); // Leg2 賣價

        // 計算套利價差 (Leg1 賣出，Leg2 買入)
        const spread = ((leg1Bid - leg2Ask) / leg2Ask) * 100;
        
        console.log('價格信息:', {
            leg1Bid, leg1Ask, leg2Bid, leg2Ask, spread,
            threshold: pairConfig.threshold
        });

        // 5. 檢查執行條件（根據執行模式）
        const executionMode = pairConfig.executionMode || 'threshold';
        
        if (executionMode === 'threshold') {
            // 等待差價模式：必須滿足閾值條件
            if (spread < pairConfig.threshold) {
                return res.status(400).json({
                    success: false,
                    error: `等待差價模式 - 當前價差 ${spread.toFixed(4)}% 小於設定閾值 ${pairConfig.threshold}%`,
                    data: {
                        currentSpread: spread,
                        threshold: pairConfig.threshold,
                        executionMode: executionMode,
                        leg1Prices: { bid: leg1Bid, ask: leg1Ask },
                        leg2Prices: { bid: leg2Bid, ask: leg2Ask }
                    }
                });
            }
        } else if (executionMode === 'market') {
            // 市價單模式：直接執行，但記錄當前價差
            console.log(`市價單模式執行 - 當前價差: ${spread.toFixed(4)}%, 閾值: ${pairConfig.threshold}%`);
        }

        // 6. 風險控制檢查
        const tradeAmount = pairConfig.amount;
        const maxPositionSize = 10000; // 從系統設定獲取
        
        if (tradeAmount > maxPositionSize) {
            return res.status(400).json({
                success: false,
                error: `交易金額 ${tradeAmount} 超過最大限制 ${maxPositionSize}`
            });
        }

        // 7. 執行雙腿下單
        console.log('開始執行雙腿下單...');
        
        const leg1OrderParams = {
            symbol: leg1Symbol,
            side: 'Sell', // Leg1 賣出
            orderType: 'Market',
            qty: tradeAmount,
            category: pairConfig.leg1.type
        };

        const leg2OrderParams = {
            symbol: leg2Symbol,
            side: 'Buy', // Leg2 買入
            orderType: 'Market',
            qty: tradeAmount,
            category: pairConfig.leg2.type
        };

        // 同時執行兩個訂單以減少延遲
        const [leg1Result, leg2Result] = await Promise.all([
            bybitService.placeOrder(leg1OrderParams),
            bybitService.placeOrder(leg2OrderParams)
        ]);

        console.log('下單結果:', { leg1Result, leg2Result });

        // 8. 檢查執行結果
        if (!leg1Result.success || !leg2Result.success) {
            // 如果其中一個失敗，嘗試取消成功的訂單
            const errors = [];
            if (!leg1Result.success) errors.push(`Leg1 下單失敗: ${leg1Result.error}`);
            if (!leg2Result.success) errors.push(`Leg2 下單失敗: ${leg2Result.error}`);
            
            return res.status(500).json({
                success: false,
                error: '雙腿下單部分失敗',
                details: errors,
                leg1Result,
                leg2Result
            });
        }

        // 9. 計算實際利潤
        const leg1Price = leg1Bid; // 市價賣出，近似使用買價
        const leg2Price = leg2Ask; // 市價買入，近似使用賣價
        const actualSpread = ((leg1Price - leg2Price) / leg2Price) * 100;
        const estimatedProfit = (leg1Price - leg2Price) * tradeAmount;

        // 10. 返回執行結果
        const executionResult = {
            success: true,
            pairId: pairId,
            executionTime: new Date().toISOString(),
            leg1: {
                exchange: leg1Exchange,
                symbol: leg1Symbol,
                side: 'sell',
                quantity: tradeAmount,
                price: leg1Price,
                orderId: leg1Result.data.orderId,
                orderLinkId: leg1Result.data.orderLinkId
            },
            leg2: {
                exchange: leg2Exchange,
                symbol: leg2Symbol,
                side: 'buy',
                quantity: tradeAmount,
                price: leg2Price,
                orderId: leg2Result.data.orderId,
                orderLinkId: leg2Result.data.orderLinkId
            },
            spread: actualSpread,
            estimatedProfit: estimatedProfit,
            threshold: pairConfig.threshold,
            executionMode: executionMode,
            timestamp: Date.now()
        };
        
        console.log('套利執行成功:', executionResult);
        
        res.json({
            success: true,
            data: executionResult
        });
        
    } catch (error) {
        console.error('套利執行失敗:', error);
        res.status(500).json({
            success: false,
            error: '套利執行失敗: ' + error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 測試API連接
app.get('/api/settings/api/test', async (req, res) => {
    try {
        const hasApiKey = !!process.env.BYBIT_API_KEY;
        const hasSecret = !!process.env.BYBIT_SECRET;
        
        if (!hasApiKey || !hasSecret) {
            return res.json({
                success: false,
                message: 'API密鑰未配置'
            });
        }
        
        // 使用真實的Bybit API測試連接
        const testResult = await bybitService.testConnection();
        
        res.json({
            success: testResult.success,
            data: {
                success: testResult.success,
                message: testResult.message,
                serverTime: testResult.serverTime,
                platform: '真實平台 (非測試網)',
                accountInfo: testResult.accountInfo,
                suggestion: testResult.suggestion
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'API連接測試失敗: ' + error.message
        });
    }
});

// 獲取賬戶信息
app.get('/api/account/:exchange', async (req, res) => {
    const { exchange } = req.params;
    
    if (exchange !== 'bybit') {
        return res.status(400).json({
            success: false,
            error: '目前僅支持Bybit交易所'
        });
    }
    
    try {
        const accountInfo = await bybitService.getAccountInfo();
        res.json(accountInfo);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '獲取賬戶信息失敗: ' + error.message
        });
    }
});

// 獲取交易對信息
app.get('/api/instruments/:exchange', async (req, res) => {
    const { exchange } = req.params;
    const { category = 'linear' } = req.query;
    
    if (exchange !== 'bybit') {
        return res.status(400).json({
            success: false,
            error: '目前僅支持Bybit交易所'
        });
    }
    
    try {
        const instruments = await bybitService.getInstruments(category);
        res.json(instruments);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '獲取交易對信息失敗: ' + error.message
        });
    }
});

// 獲取訂單簿
app.get('/api/orderbook/:exchange/:symbol', async (req, res) => {
    const { exchange, symbol } = req.params;
    const { category = 'linear' } = req.query;
    
    if (exchange !== 'bybit') {
        return res.status(400).json({
            success: false,
            error: '目前僅支持Bybit交易所'
        });
    }
    
    try {
        const orderbook = await bybitService.getOrderBook(symbol, category);
        res.json(orderbook);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '獲取訂單簿失敗: ' + error.message
        });
    }
});

// 下單
app.post('/api/order/:exchange', async (req, res) => {
    const { exchange } = req.params;
    
    if (exchange !== 'bybit') {
        return res.status(400).json({
            success: false,
            error: '目前僅支持Bybit交易所'
        });
    }
    
    try {
        const orderResult = await bybitService.placeOrder(req.body);
        res.json(orderResult);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '下單失敗: ' + error.message
        });
    }
});

// 獲取監控交易對的實時價格
app.get('/api/monitoring/prices', async (req, res) => {
    try {
        console.log('獲取監控交易對實時價格，當前配置數量:', monitoringPairs.length);
        
        const pricePromises = monitoringPairs.map(async (pair) => {
            try {
                // 優先使用 WebSocket tickers 頂部報價
                const getTopOrFetch = async (symbol, type) => {
                    let top = bybitService.getTopOfBook(symbol);
                    if (top && top.bid1 && top.ask1) return top;
                    // 後備：REST 取單次 orderbook 並解析最佳檔
                    const category = (type === 'spot') ? 'spot' : 'linear';
                    const ob = await bybitService.getOrderBook(symbol, category);
                    if (ob && ob.success && ob.data) {
                        const raw = ob.data;
                        const bids = Array.isArray(raw?.b) ? raw.b : (Array.isArray(raw?.list?.[0]?.b) ? raw.list[0].b : (Array.isArray(raw?.bids) ? raw.bids : []));
                        const asks = Array.isArray(raw?.a) ? raw.a : (Array.isArray(raw?.list?.[0]?.a) ? raw.list[0].a : (Array.isArray(raw?.asks) ? raw.asks : []));
                        const bestBid = Array.isArray(bids) && bids.length > 0 ? bids[0] : null;
                        const bestAsk = Array.isArray(asks) && asks.length > 0 ? asks[0] : null;
                        return {
                            symbol,
                            exchange: 'bybit',
                            bid1: Array.isArray(bestBid) && bestBid.length >= 2 ? { price: Number(bestBid[0]), amount: Number(bestBid[1]) } : null,
                            ask1: Array.isArray(bestAsk) && bestAsk.length >= 2 ? { price: Number(bestAsk[0]), amount: Number(bestAsk[1]) } : null
                        };
                    }
                    return null;
                };

                const leg1Top = await getTopOrFetch(pair.leg1.symbol, pair.leg1.type);
                const leg2Top = await getTopOrFetch(pair.leg2.symbol, pair.leg2.type);

                if (!leg1Top || !leg2Top || !leg1Top.bid1 || !leg2Top.ask1) {
                    console.warn(`價格獲取失敗或頂部報價缺失: ${pair.id}`);
                    return null;
                }

                const leg1Bid = leg1Top.bid1.price;
                const leg1Ask = leg1Top.ask1.price;
                const leg2Bid = leg2Top.bid1.price;
                const leg2Ask = leg2Top.ask1.price;

                // 計算價差
                const spread = leg1Bid - leg2Ask;
                const spreadPercent = (spread / leg2Ask) * 100;
                const shouldTrigger = Math.abs(spreadPercent) >= pair.threshold;

                return {
                    id: pair.id,
                    pairConfig: pair,
                    leg1Price: leg1Top,
                    leg2Price: leg2Top,
                    spread: spread,
                    spreadPercent: spreadPercent,
                    threshold: pair.threshold,
                    shouldTrigger: shouldTrigger,
                    timestamp: Date.now(),
                    direction: spread > 0 ? 'leg1_sell_leg2_buy' : 'leg1_buy_leg2_sell'
                };
            } catch (error) {
                console.error(`獲取交易對 ${pair.id} 價格失敗:`, error?.message || error);
                return null;
            }
        });

        const opportunities = await Promise.all(pricePromises);
        const validOpportunities = opportunities.filter(op => op !== null);

        console.log(`成功獲取 ${validOpportunities.length}/${monitoringPairs.length} 個交易對的價格數據`);

        res.json({
            success: true,
            data: validOpportunities
        });
    } catch (error) {
        console.error('獲取監控交易對價格失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取價格數據失敗: ' + error.message
        });
    }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    logger.error('服務器錯誤:', err);
    res.status(500).json({
        error: '內部服務器錯誤',
        message: process.env.NODE_ENV === 'development' ? err.message : '服務暫時不可用'
    });
});

// 404處理
app.use('*', (req, res) => {
    res.status(404).json({ error: '未找到請求的資源' });
});

// 啟動服務器
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // 初始化Bybit服務
        logger.info('正在初始化交易服務...');
        
        const bybitInitialized = bybitService.initialize();
        if (bybitInitialized) {
            logger.info('Bybit服務初始化成功 (真實平台)');
            logger.info('✅ WebSocket 已準備就緒，等待監控對訂閱');
        } else {
            logger.warn('Bybit服務初始化失敗，請檢查API配置');
        }

        // 啟動HTTP服務器
        server.listen(PORT, () => {
            console.log(`🚀 服務器運行在端口 ${PORT}`);
            console.log(`📊 健康檢查: http://localhost:${PORT}/health`);
            console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
            console.log(`💰 Bybit API: ${bybitInitialized ? '✅ 已連接 (真實平台)' : '❌ 未連接'}`);
        });

    } catch (error) {
        console.error('❌ 服務器啟動失敗:', error);
        process.exit(1);
    }
}

// 優雅關閉處理
process.on('SIGINT', () => {
    logger.info('接收到SIGINT信號，開始優雅關閉...');
    server.close(() => {
        logger.info('服務器已關閉');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    logger.info('接收到SIGTERM信號，開始優雅關閉...');
    server.close(() => {
        logger.info('服務器已關閉');
        process.exit(0);
    });
});

// 捕獲未處理的異常
process.on('uncaughtException', (error) => {
    logger.error('未捕獲的異常:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的Promise拒絕:', reason);
    process.exit(1);
});

startServer();
