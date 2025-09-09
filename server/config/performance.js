/**
 * 性能優化配置
 * 跨交易所套利系統的性能調優參數
 */

module.exports = {
    // 套利引擎配置
    arbitrageEngine: {
        // 價格監控間隔 (毫秒)
        priceUpdateInterval: 1000,
        
        // 最大並發套利交易數
        maxConcurrentArbitrages: 5,
        
        // 套利機會檢測超時 (毫秒)
        opportunityDetectionTimeout: 500,
        
        // 價格數據緩存時間 (毫秒)
        priceCacheTimeout: 2000,
        
        // 最大監控交易對數量
        maxMonitoringPairs: 50
    },
    
    // 交易所連接配置
    exchanges: {
        bybit: {
            // WebSocket 重連間隔 (毫秒)
            reconnectInterval: 5000,
            
            // 最大重連次數
            maxReconnectAttempts: 10,
            
            // API 請求超時 (毫秒)
            requestTimeout: 10000,
            
            // 速率限制 (請求/分鐘)
            rateLimit: 1200,
            
            // 並發請求數
            maxConcurrentRequests: 10
        },
        
        binance: {
            // WebSocket 重連間隔 (毫秒)
            reconnectInterval: 5000,
            
            // 最大重連次數
            maxReconnectAttempts: 10,
            
            // API 請求超時 (毫秒)
            requestTimeout: 10000,
            
            // 速率限制 (請求/分鐘)
            rateLimit: 1200,
            
            // 並發請求數
            maxConcurrentRequests: 10,
            
            // 監聽密鑰刷新間隔 (毫秒)
            listenKeyRefreshInterval: 1800000 // 30分鐘
        }
    },
    
    // 風險控制配置
    riskControl: {
        // 最大單筆交易金額
        maxPositionSize: 10000,
        
        // 最大日虧損
        maxDailyLoss: 1000,
        
        // 價格偏差閾值
        priceDeviationThreshold: 0.05,
        
        // 最小價差閾值
        minSpreadThreshold: 0.01,
        
        // 最大價差閾值
        maxSpreadThreshold: 1.0,
        
        // 交易頻率限制 (次/分鐘)
        maxTradesPerMinute: 10
    },
    
    // 性能監控配置
    performance: {
        // 監控檢查間隔 (毫秒)
        checkInterval: 5000,
        
        // 最大響應時間 (毫秒)
        maxResponseTime: 1000,
        
        // 最小成功率
        minSuccessRate: 0.95,
        
        // 最大內存使用 (字節)
        maxMemoryUsage: 500 * 1024 * 1024,
        
        // 警報閾值
        alertThresholds: {
            responseTime: 2000,
            successRate: 0.9,
            memoryUsage: 400 * 1024 * 1024,
            errorRate: 0.1
        }
    },
    
    // 緩存配置
    cache: {
        // 默認 TTL (秒)
        defaultTTL: 3600, // 1小時
        
        // 緩存前綴
        prefix: 'arbitrage',
        
        // 清理間隔 (毫秒)
        cleanupInterval: 300000, // 5分鐘
        
        // Redis 配置
        redis: {
            enabled: process.env.REDIS_ENABLED === 'true',
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: process.env.REDIS_DB || 0
        },
        
        // 特定數據類型的 TTL
        ttl: {
            // 價格數據緩存時間 (秒)
            priceData: 2,
            
            // 訂單簿緩存時間 (秒)
            orderBook: 1,
            
            // 賬戶信息緩存時間 (秒)
            accountInfo: 30,
            
            // 交易對信息緩存時間 (秒)
            symbolInfo: 300, // 5分鐘
            
            // 性能指標緩存時間 (秒)
            performanceMetrics: 60,
            
            // 告警數據緩存時間 (秒)
            alertData: 300,
            
            // 監控數據緩存時間 (秒)
            monitoringData: 10
        },
        
        // 最大緩存條目數
        maxCacheEntries: 1000,
        
        // 緩存策略
        strategy: {
            // 是否啟用 LRU 策略
            enableLRU: true,
            
            // 是否啟用 TTL 策略
            enableTTL: true,
            
            // 是否啟用預熱
            enableWarmup: true
        }
    },
    
    // 日誌配置
    logging: {
        // 日誌級別
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        
        // 性能日誌間隔 (毫秒)
        performanceLogInterval: 60000, // 1分鐘
        
        // 是否記錄詳細的套利日誌
        detailedArbitrageLogs: true,
        
        // 是否記錄 API 請求日誌
        apiRequestLogs: process.env.NODE_ENV !== 'production',
        
        // 最大日誌文件大小 (字節)
        maxLogFileSize: 10 * 1024 * 1024, // 10MB
        
        // 最大日誌文件數量
        maxLogFiles: 5
    },
    
    // 數據庫配置
    database: {
        // 連接池大小
        poolSize: 10,
        
        // 連接超時 (毫秒)
        connectionTimeout: 30000,
        
        // 查詢超時 (毫秒)
        queryTimeout: 10000,
        
        // 是否啟用查詢緩存
        enableQueryCache: true,
        
        // 查詢緩存時間 (毫秒)
        queryCacheTTL: 60000
    },
    
    // WebSocket 配置
    websocket: {
        // 心跳間隔 (毫秒)
        heartbeatInterval: 30000,
        
        // 心跳超時 (毫秒)
        heartbeatTimeout: 10000,
        
        // 最大消息隊列大小
        maxMessageQueueSize: 1000,
        
        // 消息處理超時 (毫秒)
        messageProcessingTimeout: 5000,
        
        // 是否啟用消息壓縮
        enableCompression: true
    },
    
    // 優化建議
    optimizations: {
        // 是否啟用價格數據預取
        enablePricePrefetch: true,
        
        // 是否啟用並行套利檢測
        enableParallelDetection: true,
        
        // 是否啟用智能路由
        enableSmartRouting: true,
        
        // 是否啟用動態閾值調整
        enableDynamicThresholds: false,
        
        // 是否啟用機器學習預測
        enableMLPrediction: false
    },
    
    // 環境特定配置
    environments: {
        development: {
            arbitrageEngine: {
                priceUpdateInterval: 2000, // 更慢的更新間隔用於調試
                maxConcurrentArbitrages: 2
            },
            logging: {
                level: 'debug',
                detailedArbitrageLogs: true,
                apiRequestLogs: true
            }
        },
        
        production: {
            arbitrageEngine: {
                priceUpdateInterval: 500, // 更快的更新間隔
                maxConcurrentArbitrages: 10
            },
            logging: {
                level: 'info',
                detailedArbitrageLogs: false,
                apiRequestLogs: false
            },
            performance: {
                checkInterval: 3000, // 更頻繁的檢查
                maxResponseTime: 800
            }
        },
        
        test: {
            arbitrageEngine: {
                priceUpdateInterval: 1000,
                maxConcurrentArbitrages: 1
            },
            logging: {
                level: 'error',
                detailedArbitrageLogs: false,
                apiRequestLogs: false
            }
        }
    }
};
