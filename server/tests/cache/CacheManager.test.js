/**
 * CacheManager 測試
 */

const CacheManager = require('../../services/CacheManager');
const logger = require('../../utils/logger');

// Mock logger
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

// Mock Redis
jest.mock('redis', () => ({
    createClient: jest.fn(() => ({
        connect: jest.fn().mockResolvedValue(true),
        quit: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        setEx: jest.fn().mockResolvedValue(true),
        get: jest.fn().mockResolvedValue(null),
        mGet: jest.fn().mockResolvedValue([]),
        mSet: jest.fn().mockResolvedValue(true),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
        ttl: jest.fn().mockResolvedValue(-1),
        flushDb: jest.fn().mockResolvedValue(true),
        info: jest.fn().mockResolvedValue('used_memory:1024'),
        isReady: false,
        multi: jest.fn(() => ({
            setEx: jest.fn(),
            exec: jest.fn().mockResolvedValue([true])
        }))
    }))
}));

describe('CacheManager', () => {
    let cacheManager;

    beforeEach(() => {
        cacheManager = new CacheManager();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        if (cacheManager && cacheManager.isInitialized) {
            await cacheManager.close();
        }
    });

    describe('初始化', () => {
        test('應該正確初始化緩存管理器', async () => {
            await cacheManager.initialize();
            
            expect(cacheManager.isInitialized).toBe(true);
            expect(cacheManager.stats).toBeDefined();
            expect(cacheManager.caches).toBeInstanceOf(Map);
        });

        test('應該設置默認統計數據', () => {
            expect(cacheManager.stats).toEqual({
                hits: 0,
                misses: 0,
                sets: 0,
                deletes: 0,
                errors: 0
            });
        });
    });

    describe('緩存操作', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('應該能夠設置和獲取緩存', async () => {
            const key = 'test_key';
            const value = { test: 'data' };

            await cacheManager.set(key, value);
            const result = await cacheManager.get(key);

            expect(result).toEqual(value);
            expect(cacheManager.stats.sets).toBe(1);
            expect(cacheManager.stats.hits).toBe(1);
        });

        test('應該能夠刪除緩存', async () => {
            const key = 'test_key';
            const value = { test: 'data' };

            await cacheManager.set(key, value);
            await cacheManager.delete(key);
            const result = await cacheManager.get(key);

            expect(result).toBeNull();
            expect(cacheManager.stats.deletes).toBe(1);
        });

        test('應該能夠檢查緩存是否存在', async () => {
            await cacheManager.initialize();
            
            const key = 'test_key';
            const value = { test: 'data' };

            expect(await cacheManager.exists(key)).toBe(false);
            
            await cacheManager.set(key, value);
            expect(await cacheManager.exists(key)).toBe(true);
        });

        test('應該能夠獲取緩存 TTL', async () => {
            const key = 'test_key';
            const value = { test: 'data' };

            await cacheManager.set(key, value, 60); // 60秒 TTL
            const ttl = await cacheManager.ttl(key);

            expect(ttl).toBeGreaterThan(0);
        });
    });

    describe('批量操作', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('應該能夠批量設置緩存', async () => {
            const keyValuePairs = [
                ['key1', { data: 1 }],
                ['key2', { data: 2 }],
                ['key3', { data: 3 }]
            ];

            await cacheManager.mset(keyValuePairs);
            
            expect(cacheManager.stats.sets).toBe(3);
        });

        test('應該能夠批量獲取緩存', async () => {
            const keyValuePairs = [
                ['key1', { data: 1 }],
                ['key2', { data: 2 }],
                ['key3', { data: 3 }]
            ];

            await cacheManager.mset(keyValuePairs);
            const results = await cacheManager.mget(['key1', 'key2', 'key3']);

            expect(results).toHaveLength(3);
            expect(results[0]).toEqual({ data: 1 });
            expect(results[1]).toEqual({ data: 2 });
            expect(results[2]).toEqual({ data: 3 });
        });
    });

    describe('緩存統計', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('應該提供緩存統計信息', async () => {
            await cacheManager.set('key1', 'value1');
            await cacheManager.get('key1');
            await cacheManager.get('nonexistent');

            const stats = cacheManager.getStats();

            expect(stats).toHaveProperty('hits');
            expect(stats).toHaveProperty('misses');
            expect(stats).toHaveProperty('sets');
            expect(stats).toHaveProperty('hitRate');
            expect(stats).toHaveProperty('totalRequests');
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.sets).toBe(1);
        });

        test('應該計算正確的命中率', async () => {
            // 設置一些緩存
            await cacheManager.set('key1', 'value1');
            await cacheManager.set('key2', 'value2');
            
            // 獲取一些緩存（命中）
            await cacheManager.get('key1');
            await cacheManager.get('key2');
            
            // 獲取不存在的緩存（未命中）
            await cacheManager.get('nonexistent');

            const stats = cacheManager.getStats();
            expect(stats.hitRate).toBe('66.67%');
        });
    });

    describe('緩存清理', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('應該能夠清理過期緩存', async () => {
            // 設置一個短期緩存
            await cacheManager.set('short_key', 'value', 1); // 1秒 TTL
            
            // 等待過期
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            // 執行清理
            await cacheManager.cleanup();
            
            // 檢查緩存是否被清理
            const result = await cacheManager.get('short_key');
            expect(result).toBeNull();
        });

        test('應該能夠清空所有緩存', async () => {
            await cacheManager.set('key1', 'value1');
            await cacheManager.set('key2', 'value2');
            
            await cacheManager.flush();
            
            const result1 = await cacheManager.get('key1');
            const result2 = await cacheManager.get('key2');
            
            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });
    });

    describe('緩存預熱', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('應該能夠預熱緩存', async () => {
            const warmupData = {
                'warmup_key1': { data: 1 },
                'warmup_key2': { data: 2 },
                'warmup_key3': { data: 3 }
            };

            await cacheManager.warmup(warmupData);
            
            const result1 = await cacheManager.get('warmup_key1');
            const result2 = await cacheManager.get('warmup_key2');
            const result3 = await cacheManager.get('warmup_key3');
            
            expect(result1).toEqual({ data: 1 });
            expect(result2).toEqual({ data: 2 });
            expect(result3).toEqual({ data: 3 });
        });
    });

    describe('緩存鍵生成', () => {
        test('應該正確生成緩存鍵', () => {
            const key = cacheManager.generateKey('test_key');
            expect(key).toBe('arbitrage:test_key');
        });
    });

    describe('錯誤處理', () => {
        test('應該處理緩存操作錯誤', async () => {
            // 模擬 Redis 錯誤
            const mockRedis = require('redis').createClient();
            mockRedis.setEx.mockRejectedValue(new Error('Redis 錯誤'));
            
            cacheManager.redis = mockRedis;
            
            await expect(cacheManager.set('key', 'value')).rejects.toThrow('Redis 錯誤');
            expect(cacheManager.stats.errors).toBe(1);
        });

        test('應該處理獲取緩存錯誤', async () => {
            await cacheManager.initialize();
            
            // 模擬 JSON 解析錯誤
            const mockRedis = require('redis').createClient();
            mockRedis.get.mockResolvedValue('invalid json');
            
            cacheManager.redis = mockRedis;
            
            const result = await cacheManager.get('key');
            expect(result).toBeNull();
            expect(cacheManager.stats.errors).toBe(1);
        });
    });

    describe('關閉和清理', () => {
        test('應該能夠正確關閉緩存管理器', async () => {
            await cacheManager.initialize();
            expect(cacheManager.isInitialized).toBe(true);
            
            await cacheManager.close();
            expect(cacheManager.isInitialized).toBe(false);
            expect(cacheManager.redis).toBeNull();
        });
    });
});
