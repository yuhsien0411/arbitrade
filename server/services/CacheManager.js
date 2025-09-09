/**
 * 緩存管理器
 * 統一管理系統緩存
 */

const Redis = require('redis');
const logger = require('../utils/logger');

class CacheManager {
    constructor() {
        this.caches = new Map();
        this.redis = null;
        this.config = require('../config/performance');
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
        this.isInitialized = false;
        this.cleanupInterval = null;
    }

    /**
     * 初始化緩存系統
     */
    async initialize() {
        try {
            // 初始化 Redis 連接
            if (this.config.cache && this.config.cache.redis && this.config.cache.redis.enabled) {
                this.redis = Redis.createClient({
                    host: this.config.cache.redis.host || 'localhost',
                    port: this.config.cache.redis.port || 6379,
                    password: this.config.cache.redis.password,
                    db: this.config.cache.redis.db || 0
                });

                this.redis.on('error', (err) => {
                    logger.error('Redis 連接錯誤:', err);
                    this.stats.errors++;
                });

                this.redis.on('connect', () => {
                    logger.info('Redis 連接成功');
                });

                await this.redis.connect();
            }

            // 初始化內存緩存
            this.initializeMemoryCaches();
            
            this.isInitialized = true;
            logger.info('緩存管理器初始化成功');
        } catch (error) {
            logger.error('緩存管理器初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 設置緩存
     */
    async set(key, value, ttl = null) {
        try {
            const cacheKey = this.generateKey(key);
            const cacheValue = JSON.stringify(value);
            const expiry = ttl || (this.config.cache && this.config.cache.defaultTTL) || 3600; // 默認1小時

            if (this.redis) {
                await this.redis.setEx(cacheKey, expiry, cacheValue);
            } else {
                this.caches.set(cacheKey, {
                    value: cacheValue,
                    expiry: Date.now() + expiry * 1000
                });
            }

            this.stats.sets++;
            logger.debug(`緩存設置成功: ${cacheKey}`);
        } catch (error) {
            this.stats.errors++;
            logger.error('設置緩存失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取緩存
     */
    async get(key) {
        try {
            const cacheKey = this.generateKey(key);
            let value = null;

            if (this.redis) {
                const cached = await this.redis.get(cacheKey);
                value = cached ? JSON.parse(cached) : null;
            } else {
                const cached = this.caches.get(cacheKey);
                if (cached && cached.expiry > Date.now()) {
                    value = JSON.parse(cached.value);
                }
            }

            if (value !== null) {
                this.stats.hits++;
                logger.debug(`緩存命中: ${cacheKey}`);
            } else {
                this.stats.misses++;
                logger.debug(`緩存未命中: ${cacheKey}`);
            }

            return value;
        } catch (error) {
            this.stats.errors++;
            logger.error('獲取緩存失敗:', error);
            return null;
        }
    }

    /**
     * 刪除緩存
     */
    async delete(key) {
        try {
            const cacheKey = this.generateKey(key);

            if (this.redis) {
                await this.redis.del(cacheKey);
            } else {
                this.caches.delete(cacheKey);
            }

            this.stats.deletes++;
            logger.debug(`緩存刪除成功: ${cacheKey}`);
        } catch (error) {
            this.stats.errors++;
            logger.error('刪除緩存失敗:', error);
            throw error;
        }
    }

    /**
     * 批量獲取緩存
     */
    async mget(keys) {
        try {
            const cacheKeys = keys.map(key => this.generateKey(key));
            let values = [];

            if (this.redis) {
                const cached = await this.redis.mGet(cacheKeys);
                values = cached.map(c => c ? JSON.parse(c) : null);
            } else {
                values = cacheKeys.map(cacheKey => {
                    const cached = this.caches.get(cacheKey);
                    if (cached && cached.expiry > Date.now()) {
                        return JSON.parse(cached.value);
                    }
                    return null;
                });
            }

            // 更新統計
            const hits = values.filter(v => v !== null).length;
            const misses = values.length - hits;
            this.stats.hits += hits;
            this.stats.misses += misses;

            return values;
        } catch (error) {
            this.stats.errors++;
            logger.error('批量獲取緩存失敗:', error);
            return keys.map(() => null);
        }
    }

    /**
     * 批量設置緩存
     */
    async mset(keyValuePairs, ttl = null) {
        try {
            const expiry = ttl || (this.config.cache && this.config.cache.defaultTTL) || 3600;

            if (this.redis) {
                const pipeline = this.redis.multi();
                for (const [key, value] of keyValuePairs) {
                    const cacheKey = this.generateKey(key);
                    const cacheValue = JSON.stringify(value);
                    pipeline.setEx(cacheKey, expiry, cacheValue);
                }
                await pipeline.exec();
            } else {
                for (const [key, value] of keyValuePairs) {
                    const cacheKey = this.generateKey(key);
                    const cacheValue = JSON.stringify(value);
                    this.caches.set(cacheKey, {
                        value: cacheValue,
                        expiry: Date.now() + expiry * 1000
                    });
                }
            }

            this.stats.sets += keyValuePairs.length;
            logger.debug(`批量設置緩存成功: ${keyValuePairs.length} 個鍵值對`);
        } catch (error) {
            this.stats.errors++;
            logger.error('批量設置緩存失敗:', error);
            throw error;
        }
    }

    /**
     * 檢查緩存是否存在
     */
    async exists(key) {
        try {
            const cacheKey = this.generateKey(key);

            if (this.redis && this.redis.isReady) {
                const exists = await this.redis.exists(cacheKey);
                return exists === 1;
            } else {
                if (!this.caches) {
                    return false;
                }
                const cached = this.caches.get(cacheKey);
                return !!(cached && cached.expiry > Date.now());
            }
        } catch (error) {
            this.stats.errors++;
            logger.error('檢查緩存存在性失敗:', error);
            return false;
        }
    }

    /**
     * 獲取緩存剩餘時間
     */
    async ttl(key) {
        try {
            const cacheKey = this.generateKey(key);

            if (this.redis) {
                return await this.redis.ttl(cacheKey);
            } else {
                const cached = this.caches.get(cacheKey);
                if (cached) {
                    const remaining = Math.floor((cached.expiry - Date.now()) / 1000);
                    return remaining > 0 ? remaining : -1;
                }
                return -1;
            }
        } catch (error) {
            this.stats.errors++;
            logger.error('獲取緩存TTL失敗:', error);
            return -1;
        }
    }

    /**
     * 清理過期緩存
     */
    async cleanup() {
        try {
            if (!this.redis) {
                const now = Date.now();
                let cleanedCount = 0;
                
                for (const [key, cached] of this.caches) {
                    if (cached.expiry <= now) {
                        this.caches.delete(key);
                        cleanedCount++;
                    }
                }
                
                if (cleanedCount > 0) {
                    logger.debug(`清理了 ${cleanedCount} 個過期緩存項`);
                }
            }

            logger.debug('緩存清理完成');
        } catch (error) {
            logger.error('緩存清理失敗:', error);
        }
    }

    /**
     * 清空所有緩存
     */
    async flush() {
        try {
            if (this.redis) {
                await this.redis.flushDb();
            } else {
                this.caches.clear();
            }

            logger.info('所有緩存已清空');
        } catch (error) {
            this.stats.errors++;
            logger.error('清空緩存失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取緩存統計
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            totalRequests: total,
            cacheSize: this.redis ? 'Redis' : this.caches.size,
            isRedisEnabled: !!this.redis,
            isInitialized: this.isInitialized
        };
    }

    /**
     * 生成緩存鍵
     */
    generateKey(key) {
        const prefix = (this.config.cache && this.config.cache.prefix) || 'arbitrage';
        return `${prefix}:${key}`;
    }

    /**
     * 初始化內存緩存
     */
    initializeMemoryCaches() {
        // 初始化內存緩存
        this.caches = new Map();
        
        // 設置定期清理
        const cleanupInterval = (this.config.cache && this.config.cache.cleanupInterval) || 300000; // 5分鐘
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, cleanupInterval);
    }

    /**
     * 緩存預熱
     */
    async warmup(data) {
        try {
            logger.info('開始緩存預熱...');
            
            const keyValuePairs = Object.entries(data);
            await this.mset(keyValuePairs);
            
            logger.info(`緩存預熱完成，預熱了 ${keyValuePairs.length} 個項目`);
        } catch (error) {
            logger.error('緩存預熱失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取緩存大小
     */
    async getCacheSize() {
        try {
            if (this.redis) {
                const info = await this.redis.info('memory');
                const usedMemory = info.match(/used_memory:(\d+)/);
                return usedMemory ? parseInt(usedMemory[1]) : 0;
            } else {
                return this.caches.size;
            }
        } catch (error) {
            logger.error('獲取緩存大小失敗:', error);
            return 0;
        }
    }

    /**
     * 關閉緩存管理器
     */
    async close() {
        try {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            if (this.redis) {
                await this.redis.quit();
                this.redis = null;
            }

            this.caches.clear();
            this.isInitialized = false;
            
            logger.info('緩存管理器已關閉');
        } catch (error) {
            logger.error('關閉緩存管理器失敗:', error);
        }
    }
}

module.exports = CacheManager;
