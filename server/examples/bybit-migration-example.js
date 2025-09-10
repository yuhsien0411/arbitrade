/*
 * Bybit 遷移示例：展示如何使用新的交易所架構
 */
require('dotenv').config();

const ExchangeFactory = require('../exchanges/index');

(async () => {
  console.log('初始化 Bybit 交易所...');
  
  // 創建 Bybit 交易所實例
  const bybitExchange = ExchangeFactory.createExchange('bybit', {
    name: 'Bybit',
    apiKey: process.env.BYBIT_API_KEY,
    secret: process.env.BYBIT_SECRET,
    testnet: process.env.BYBIT_TESTNET === 'true'
  });
  
  const ok = await bybitExchange.initialize();
  if (!ok) {
    console.error('初始化失敗，請確認環境變數 BYBIT_API_KEY/BYBIT_SECRET');
    process.exit(1);
  }

  console.log('獲取訂單簿...');
  const ob = await bybitExchange.getOrderBook('BTCUSDT', 'linear');
  console.log('OrderBook:', ob);

  console.log('下單示例...');
  const orderRes = await bybitExchange.placeOrder({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'Market',
    qty: '0.001'
  });
  console.log('PlaceOrder:', orderRes);

  console.log('訂閱 tickers...');
  await bybitExchange.subscribeToTickers([
    { symbol: 'BTCUSDT', category: 'linear' },
    { symbol: 'ETHUSDT', category: 'linear' }
  ]);

  console.log('完成');
})();

