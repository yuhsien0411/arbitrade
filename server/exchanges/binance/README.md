# Binance 交易所集成

本目錄包含 Binance 交易所的完整實現，包括 REST API 和 WebSocket 支持。

## 文件結構

```
binance/
├── BinanceExchange.js      # 主交易所類
├── BinanceWebSocket.js     # WebSocket 客戶端
├── BinanceRest.js          # REST API 客戶端
├── tests/                  # 測試文件
│   ├── BinanceExchange.test.js
│   ├── BinanceWebSocket.test.js
│   └── BinanceRest.test.js
└── README.md              # 本文檔
```

## 功能特性

### 支持的功能
- ✅ 現貨交易
- ✅ 期貨交易（通過不同的 API 端點）
- ✅ WebSocket 即時數據訂閱
- ✅ REST API 調用
- ✅ 完整的錯誤處理和重連機制
- ✅ 速率限制管理
- ✅ 訂單管理（下單、取消、查詢）
- ✅ 賬戶信息查詢（餘額、持倉）
- ✅ 市場數據（行情、訂單簿、K線）

### WebSocket 訂閱類型
- 24小時行情統計 (`@ticker`)
- 訂單簿深度 (`@depth`)
- 實時交易 (`@trade`)
- K線數據 (`@kline`)
- 用戶數據流（需要認證）

## 使用方法

### 1. 基本初始化

```javascript
const ExchangeFactory = require('../index');

// 創建 Binance 交易所實例
const binance = ExchangeFactory.createExchange('binance', {
  name: 'Binance',
  apiKey: 'your-api-key',
  secret: 'your-secret',
  testnet: true  // 使用測試網
});

// 初始化交易所
await binance.initialize();
```

### 2. 獲取市場數據

```javascript
// 獲取行情數據
const ticker = await binance.getTicker('BTCUSDT');
console.log('BTC 價格:', ticker.price);

// 獲取訂單簿
const orderBook = await binance.getOrderBook('BTCUSDT', 100);
console.log('最佳買價:', orderBook.bids[0]);
console.log('最佳賣價:', orderBook.asks[0]);

// 獲取交易對列表
const instruments = await binance.getInstruments('spot');
console.log('支持的交易對數量:', instruments.length);
```

### 3. 交易操作

```javascript
// 下單
const order = await binance.placeOrder({
  symbol: 'BTCUSDT',
  side: 'buy',
  type: 'limit',
  amount: 0.001,
  price: 50000
});
console.log('訂單ID:', order.id);

// 取消訂單
await binance.cancelOrder(order.id, 'BTCUSDT');

// 獲取當前訂單
const openOrders = await binance.restClient.getOpenOrders('BTCUSDT');
```

### 4. 賬戶信息

```javascript
// 獲取餘額
const balance = await binance.getBalance();
console.log('賬戶餘額:', balance);

// 獲取持倉（期貨）
const positions = await binance.getPosition('BTCUSDT');
console.log('BTC 持倉:', positions);
```

### 5. WebSocket 訂閱

```javascript
// 訂閱行情數據
binance.subscribeTicker('BTCUSDT');
binance.on('ticker', (data) => {
  console.log(`${data.symbol} 價格: ${data.price}`);
});

// 訂閱訂單簿
binance.subscribeOrderBook('BTCUSDT');
binance.on('orderbook', (data) => {
  console.log('訂單簿更新:', data);
});

// 訂閱交易數據
binance.subscribeTrades('BTCUSDT');
binance.on('trade', (data) => {
  console.log('新交易:', data);
});
```

### 6. 用戶數據流（需要認證）

```javascript
// 訂閱用戶數據流
await binance.wsClient.subscribeUserData();

// 監聽訂單更新
binance.wsClient.on('orderUpdate', (data) => {
  console.log('訂單狀態更新:', data);
});

// 監聽餘額更新
binance.wsClient.on('balanceUpdate', (data) => {
  console.log('餘額更新:', data);
});
```

## 配置選項

### 基本配置
```javascript
{
  name: 'Binance',           // 交易所名稱
  apiKey: 'your-api-key',    // API 密鑰
  secret: 'your-secret',     // API 密鑰
  testnet: true,             // 是否使用測試網
  rateLimit: {
    requests: 1200,          // 每分鐘請求限制
    window: 60000            // 時間窗口（毫秒）
  }
}
```

### WebSocket 配置
```javascript
{
  wsUrl: 'wss://stream.binance.com:9443/ws/',  // WebSocket URL
  pingInterval: 30000,       // 心跳間隔（毫秒）
  maxReconnectAttempts: 5,   // 最大重連次數
  reconnectInterval: 5000    // 重連間隔（毫秒）
}
```

## 錯誤處理

所有方法都會拋出適當的錯誤，建議使用 try-catch 進行錯誤處理：

```javascript
try {
  const ticker = await binance.getTicker('BTCUSDT');
  console.log('獲取成功:', ticker);
} catch (error) {
  console.error('獲取失敗:', error.message);
  
  // 檢查錯誤類型
  if (error.message.includes('Invalid symbol')) {
    console.log('無效的交易對');
  } else if (error.message.includes('API key')) {
    console.log('API 密鑰問題');
  }
}
```

## 速率限制

Binance 有嚴格的速率限制：
- 現貨 API：每分鐘 1200 次請求
- 期貨 API：每分鐘 2400 次請求
- WebSocket：每分鐘 10 次連接

本實現包含自動速率限制管理，會自動處理請求頻率。

## 測試

運行測試：

```bash
# 運行所有測試
npm test

# 運行特定測試
npm test -- --grep "BinanceExchange"

# 運行集成測試（需要真實 API 密鑰）
BINANCE_API_KEY=your-key BINANCE_SECRET=your-secret npm test
```

## 注意事項

1. **API 密鑰安全**：請妥善保管您的 API 密鑰，不要在代碼中硬編碼
2. **測試網**：建議先在測試網環境中測試您的策略
3. **速率限制**：注意遵守 Binance 的速率限制規則
4. **錯誤處理**：始終包含適當的錯誤處理邏輯
5. **WebSocket 重連**：網絡不穩定時會自動重連，但建議監聽錯誤事件

## 支持的交易對

Binance 支持數百個交易對，包括：
- 主要加密貨幣：BTC, ETH, BNB, ADA, SOL 等
- 穩定幣：USDT, USDC, BUSD 等
- 各種交易對組合

使用 `getInstruments()` 方法獲取完整的交易對列表。

## 更新日誌

- **v1.0.0** - 初始版本，支持基本的現貨交易和 WebSocket 訂閱
- 支持所有主要的 Binance API 功能
- 完整的錯誤處理和重連機制
- 全面的測試覆蓋
