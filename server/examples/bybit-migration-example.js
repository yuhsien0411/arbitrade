/*
 * Bybit 遷移示例：展示如何使用兼容性適配器調用新架構
 */
require('dotenv').config();

const BybitCompatibilityAdapter = require('../exchanges/bybit/BybitCompatibilityAdapter');

(async () => {
  console.log('初始化 Bybit 兼容性適配器...');
  const ok = await BybitCompatibilityAdapter.initialize();
  if (!ok) {
    console.error('初始化失敗，請確認環境變數 BYBIT_API_KEY/BYBIT_SECRET');
    process.exit(1);
  }

  console.log('獲取訂單簿...');
  const ob = await BybitCompatibilityAdapter.getOrderBook('BTCUSDT', 'linear');
  console.log('OrderBook:', ob);

  console.log('下單示例...');
  const orderRes = await BybitCompatibilityAdapter.placeOrder({
    symbol: 'BTCUSDT',
    side: 'buy',
    type: 'market',
    qty: '0.001'
  });
  console.log('PlaceOrder:', orderRes);

  console.log('訂閱 tickers...');
  await BybitCompatibilityAdapter.subscribeToTickers([
    { symbol: 'BTCUSDT', category: 'linear' },
    { symbol: 'ETHUSDT', category: 'linear' }
  ]);

  console.log('完成');
})();
