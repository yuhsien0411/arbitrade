require('dotenv').config();
const BybitExchange = require('./BybitExchange');

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

  console.log('[example] 獲取交易對信息');
  const instruments = await bybit.getInstruments('linear');
  console.log('[example] instruments', instruments);

  console.log('[example] 完成');
})();

