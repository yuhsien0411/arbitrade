# Bybit 模組

本目錄包含 Bybit 的新架構實作：
- `BybitExchange.js`：交易所高階封裝，整合 REST 與 WebSocket
- `BybitRest.js`：REST 請求封裝（本地/測試環境為 stub，可替換為實際實作）
- `BybitWebSocket.js`：WebSocket 封裝（本地/測試環境為 stub，可替換為實際實作）
- `tests/`：Bybit 模組之單元與整合測試
- `example.js`：使用範例

## 使用方式

```bash
# 設定環境變數
export BYBIT_API_KEY=xxx
export BYBIT_SECRET=yyy
export BYBIT_TESTNET=true
```

```js
const BybitExchange = require('./BybitExchange');

(async () => {
  const bybit = new BybitExchange({
    name: 'Bybit',
    apiKey: process.env.BYBIT_API_KEY,
    secret: process.env.BYBIT_SECRET,
    testnet: process.env.BYBIT_TESTNET === 'true'
  });

  await bybit.initialize();
  const ob = await bybit.getOrderBook('BTCUSDT', 'linear');
  console.log('orderbook', ob);
})();
```

## 測試

```bash
npm test -- bybit
```

## 注意事項
- 目前 REST 與 WebSocket 以 stub 行為供本地/CI 測試，接上真實 API 前請補齊簽名與連線實作。

