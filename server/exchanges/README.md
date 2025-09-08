# 🔄 交易所抽象層

## 📋 概述

本目錄包含交易所抽象層的實現，為多交易所支持提供統一的接口。所有交易所適配器都必須繼承 `BaseExchange` 類並實現其抽象方法。

## 🏗️ 架構設計

```
exchanges/
├── base/                    # 抽象基類
│   ├── BaseExchange.js     # 交易所基類
│   ├── BaseWebSocket.js    # WebSocket 基類
│   └── BaseRest.js         # REST API 基類
├── bybit/                  # Bybit 實現 (待實現)
├── binance/                # Binance 實現 (待實現)
├── okx/                    # OKX 實現 (待實現)
├── bitget/                 # Bitget 實現 (待實現)
└── index.js                # 交易所工廠
```

## 🔧 核心組件

### 1. BaseExchange 抽象類

所有交易所適配器的基類，定義了統一的接口：

```javascript
const BaseExchange = require('./base/BaseExchange');

class MyExchange extends BaseExchange {
  async initialize() {
    // 實現初始化邏輯
  }
  
  async getAccountInfo() {
    // 實現獲取賬戶信息
  }
  
  // ... 實現其他抽象方法
}
```

### 2. ExchangeFactory 工廠

統一創建和管理交易所實例：

```javascript
const ExchangeFactory = require('./index');

// 創建交易所實例
const exchange = ExchangeFactory.createExchange('bybit', config);

// 獲取交易所狀態
const status = ExchangeFactory.getStatus();

// 清理所有實例
await ExchangeFactory.cleanupAll();
```

### 3. TradingError 錯誤處理

統一的錯誤處理機制：

```javascript
const TradingError = require('../utils/TradingError');

// 創建特定類型的錯誤
const error = TradingError.createApiError('API 調用失敗', 'bybit');
```

## 📚 抽象方法

所有交易所適配器必須實現以下抽象方法：

| 方法 | 描述 | 參數 | 返回值 |
|------|------|------|--------|
| `initialize()` | 初始化交易所連接 | 無 | `Promise<boolean>` |
| `getAccountInfo()` | 獲取賬戶信息 | 無 | `Promise<Object>` |
| `getOrderBook(symbol, category)` | 獲取訂單簿 | symbol, category | `Promise<Object>` |
| `placeOrder(orderParams)` | 下單 | orderParams | `Promise<Object>` |
| `cancelOrder(symbol, orderId, category)` | 取消訂單 | symbol, orderId, category | `Promise<Object>` |
| `subscribeToTickers(symbols)` | 訂閱價格數據 | symbols | `Promise<boolean>` |
| `getInstruments(category)` | 獲取交易對列表 | category | `Promise<Array>` |
| `getPosition(symbol)` | 獲取持倉信息 | symbol | `Promise<Object>` |
| `getBalance(currency)` | 獲取餘額信息 | currency | `Promise<Object>` |

## 🎯 通用方法

BaseExchange 提供以下通用方法：

- `isExchangeConnected()` - 檢查連接狀態
- `getExchangeName()` - 獲取交易所名稱
- `getTopOfBook(symbol)` - 獲取頂部報價
- `updateStats(success, responseTime)` - 更新統計信息
- `getStats()` - 獲取統計信息
- `cleanup()` - 清理資源
- `testConnection()` - 測試連接

## 🧪 測試

運行測試：

```bash
# 運行所有測試
npm test

# 運行特定測試
npm test -- tests/exchanges/base/BaseExchange.test.js

# 生成覆蓋率報告
npm test -- --coverage
```

## 📝 使用示例

```javascript
const ExchangeFactory = require('./exchanges/index');

async function example() {
  // 創建配置
  const config = {
    name: 'Bybit',
    apiKey: 'your_api_key',
    secret: 'your_secret',
    testnet: false
  };
  
  // 創建交易所實例
  const exchange = ExchangeFactory.createExchange('bybit', config);
  
  // 初始化
  await exchange.initialize();
  
  // 使用交易所
  const accountInfo = await exchange.getAccountInfo();
  console.log('賬戶信息:', accountInfo);
  
  // 清理資源
  await exchange.cleanup();
}
```

## 🔄 擴展新交易所

要添加新的交易所支持：

1. 在 `exchanges/` 目錄下創建新的子目錄
2. 創建交易所類，繼承 `BaseExchange`
3. 實現所有抽象方法
4. 在 `ExchangeFactory` 中添加創建邏輯
5. 添加相應的測試

## ⚠️ 注意事項

1. **不要修改現有代碼**：只創建新文件，不修改現有功能
2. **保持向後兼容**：確保新架構不影響現有功能
3. **錯誤處理**：所有方法都要有完善的錯誤處理
4. **性能考慮**：注意內存使用和性能優化
5. **日誌記錄**：重要操作都要有日誌記錄

## 📞 支持

如有任何問題，請聯繫開發團隊。
