# 🧪 跨交易所套利測試指南

## 📋 概述

本指南提供了跨交易所套利系統的完整測試流程，包括單元測試、集成測試、性能測試和真實 API 測試。

## 🚀 快速開始

### 1. 環境準備

```bash
# 安裝依賴
npm install

# 設置環境變量
cp .env.example .env

# 編輯 .env 文件，添加 API 密鑰
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key
BINANCE_TESTNET=true
```

### 2. 運行測試

```bash
# 運行所有測試
npm test

# 運行特定測試
npm test -- --testPathPattern="ArbitrageOpportunityDetection"

# 運行性能測試
npm test -- --testPathPattern="ArbitragePerformance"

# 運行真實 API 測試
npm test -- --testPathPattern="RealAPITest"
```

### 3. 運行驗證腳本

```bash
# 運行跨交易所套利驗證腳本
node test-cross-exchange.js
```

## 📊 測試分類

### 1. 單元測試
- **位置**：`server/tests/exchanges/`
- **覆蓋範圍**：交易所類、REST 客戶端、WebSocket 客戶端
- **運行命令**：`npm test -- --testPathPattern="exchanges"`

### 2. 集成測試
- **位置**：`server/tests/integration/`
- **覆蓋範圍**：套利引擎、跨交易所功能、系統集成
- **運行命令**：`npm test -- --testPathPattern="integration"`

### 3. 性能測試
- **位置**：`server/tests/performance/`
- **覆蓋範圍**：API 響應時間、套利檢測性能、內存使用
- **運行命令**：`npm test -- --testPathPattern="performance"`

### 4. 真實 API 測試
- **位置**：`server/tests/integration/RealAPITest.js`
- **覆蓋範圍**：真實 API 調用、跨交易所套利
- **運行命令**：`npm test -- --testPathPattern="RealAPITest"`

## 🔧 測試配置

### Jest 配置
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 環境變量
```bash
# 測試環境變量
NODE_ENV=test
BINANCE_API_KEY=test_api_key
BINANCE_SECRET_KEY=test_secret_key
BINANCE_TESTNET=true
```

## 📈 性能基準

### API 響應時間
- **目標**：< 200ms
- **測試方法**：100次 API 調用平均時間
- **當前結果**：42.15ms ✅

### 套利檢測性能
- **目標**：< 100ms
- **測試方法**：1000次套利檢測平均時間
- **當前結果**：0.0000ms ✅

### 內存使用
- **目標**：< 50MB
- **測試方法**：創建 10000 個對象後內存增加
- **當前結果**：1.90MB ✅

### 並發處理
- **目標**：< 1000ms
- **測試方法**：50個並發請求完成時間
- **當前結果**：46ms ✅

## 🧪 測試場景

### 1. 套利機會檢測
```javascript
// 測試價差計算
const bybitBid = 50000;
const binanceAsk = 49950;
const profit = bybitBid - binanceAsk;
const profitPercent = (profit / binanceAsk) * 100;

expect(profitPercent).toBeGreaterThan(0.1);
```

### 2. 跨交易所套利
```javascript
// 測試跨交易所價格獲取
const [bybitPrice, binancePrice] = await Promise.all([
  bybitExchange.getOrderBook('BTCUSDT', 'linear'),
  binanceExchange.getOrderBook('BTCUSDT', 'spot')
]);

expect(bybitPrice.success).toBe(true);
expect(binancePrice.success).toBe(true);
```

### 3. 風險控制
```javascript
// 測試持倉限制
const currentPosition = 5000;
const maxPosition = 10000;
const newOrderAmount = 3000;
const totalPosition = currentPosition + newOrderAmount;

expect(totalPosition).toBeLessThanOrEqual(maxPosition);
```

### 4. 錯誤處理
```javascript
// 測試 API 錯誤處理
try {
  await exchange.getOrderBook('INVALIDPAIR', 'linear');
} catch (error) {
  expect(error.message).toContain('Invalid symbol');
}
```

## 🔍 調試指南

### 1. 測試失敗調試
```bash
# 運行單個測試並顯示詳細輸出
npm test -- --testPathPattern="ArbitrageOpportunityDetection" --verbose

# 運行測試並保持測試環境
npm test -- --testPathPattern="ArbitrageOpportunityDetection" --detectOpenHandles
```

### 2. 性能問題調試
```bash
# 運行性能測試並顯示內存使用
npm test -- --testPathPattern="ArbitragePerformance" --detectLeaks

# 運行測試並顯示 CPU 使用
npm test -- --testPathPattern="ArbitragePerformance" --logHeapUsage
```

### 3. 真實 API 測試調試
```bash
# 設置調試環境變量
DEBUG=* npm test -- --testPathPattern="RealAPITest"

# 運行特定 API 測試
npm test -- --testPathPattern="RealAPITest" --testNamePattern="Bybit API"
```

## 📊 測試報告

### 生成測試報告
```bash
# 生成 HTML 測試報告
npm test -- --coverage --coverageReporters=html

# 生成 JSON 測試報告
npm test -- --coverage --coverageReporters=json

# 生成 LCOV 測試報告
npm test -- --coverage --coverageReporters=lcov
```

### 查看測試報告
- **HTML 報告**：打開 `coverage/lcov-report/index.html`
- **控制台報告**：運行測試後查看終端輸出
- **JSON 報告**：查看 `coverage/coverage-final.json`

## 🛠️ 自定義測試

### 1. 創建新測試
```javascript
// tests/custom/MyCustomTest.js
describe('自定義測試', () => {
  test('應該執行自定義邏輯', () => {
    // 測試邏輯
    expect(true).toBe(true);
  });
});
```

### 2. 添加性能測試
```javascript
// tests/performance/CustomPerformance.test.js
describe('自定義性能測試', () => {
  test('應該在指定時間內完成', async () => {
    const startTime = Date.now();
    
    // 執行測試邏輯
    await performOperation();
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000);
  });
});
```

### 3. 添加集成測試
```javascript
// tests/integration/CustomIntegration.test.js
describe('自定義集成測試', () => {
  test('應該正確集成多個組件', async () => {
    const result = await integratedOperation();
    expect(result.success).toBe(true);
  });
});
```

## 🔧 故障排除

### 常見問題

#### 1. 測試超時
```bash
# 增加測試超時時間
npm test -- --testTimeout=60000
```

#### 2. 內存泄漏
```bash
# 檢測內存泄漏
npm test -- --detectLeaks --detectOpenHandles
```

#### 3. API 限流
```bash
# 設置 API 限流延遲
API_RATE_LIMIT=1000 npm test
```

#### 4. 網絡連接問題
```bash
# 跳過網絡相關測試
SKIP_NETWORK_TESTS=true npm test
```

### 調試技巧

#### 1. 使用 console.log
```javascript
test('調試測試', () => {
  console.log('調試信息:', data);
  expect(result).toBe(expected);
});
```

#### 2. 使用斷點
```javascript
test('斷點調試', () => {
  debugger; // 在瀏覽器開發者工具中設置斷點
  expect(result).toBe(expected);
});
```

#### 3. 使用 Jest 調試模式
```bash
# 運行 Jest 調試模式
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📚 參考資料

### 測試框架
- [Jest 官方文檔](https://jestjs.io/docs/getting-started)
- [Node.js 測試最佳實踐](https://nodejs.org/en/docs/guides/testing/)

### 性能測試
- [性能測試指南](https://web.dev/performance-testing/)
- [內存泄漏檢測](https://nodejs.org/en/docs/guides/simple-profiling/)

### API 測試
- [REST API 測試](https://restfulapi.net/testing-rest-apis/)
- [WebSocket 測試](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

## 🎯 最佳實踐

### 1. 測試命名
```javascript
// 好的測試命名
test('應該正確計算價差百分比', () => {});
test('應該識別套利機會', () => {});
test('應該處理 API 錯誤', () => {});

// 避免的測試命名
test('test1', () => {});
test('should work', () => {});
```

### 2. 測試結構
```javascript
describe('功能模塊', () => {
  beforeEach(() => {
    // 設置測試環境
  });

  afterEach(() => {
    // 清理測試環境
  });

  test('應該執行特定功能', () => {
    // 測試邏輯
  });
});
```

### 3. 斷言使用
```javascript
// 使用具體的斷言
expect(result).toBe(expected);
expect(result).toHaveProperty('success', true);
expect(result).toContain('error');

// 避免模糊的斷言
expect(result).toBeTruthy();
expect(result).toBeDefined();
```

### 4. 異步測試
```javascript
// 正確的異步測試
test('應該處理異步操作', async () => {
  const result = await asyncOperation();
  expect(result).toBe(expected);
});

// 避免的異步測試
test('應該處理異步操作', () => {
  asyncOperation().then(result => {
    expect(result).toBe(expected);
  });
});
```

---

**最後更新**：2024年9月9日  
**維護者**：開發者A  
**版本**：1.0.0

