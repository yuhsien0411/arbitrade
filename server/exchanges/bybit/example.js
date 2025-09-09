require('dotenv').config();
const BybitExchange = require('./BybitExchange');
const BybitCompatibilityAdapter = require('./BybitCompatibilityAdapter');

(async () => {
  console.log('[example] BybitExchange 初始化');
  const bybit = new BybitExchange({
    name: 'Bybit',
    apiKey: process.env.BYBIT_API_KEY,
    secret: process.env.BYBIT_SECRET,
    testnet: process.env.BYBIT_TESTNET === 'true'
  });
  await bybit.initialize();

  const ob = await bybit.getOrderBook('BTCUSDT', 'linear');
  console.log('[example] orderbook', ob);

  console.log('[example] 兼容性適配器初始化');
  await BybitCompatibilityAdapter.initialize();
  const ob2 = await BybitCompatibilityAdapter.getOrderBook('BTCUSDT', 'linear');
  console.log('[example] adapter orderbook', ob2);
})();
