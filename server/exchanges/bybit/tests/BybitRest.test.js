const BybitRest = require('../BybitRest');

describe('BybitRest', () => {
  let rest;

  beforeEach(async () => {
    rest = new BybitRest({ name: 'Bybit', testnet: true });
    await rest.initialize();
  });

  test('應該能初始化', async () => {
    expect(rest).toBeDefined();
  });

  test('應該能獲取訂單簿(Stub)', async () => {
    const res = await rest.getOrderBook('BTCUSDT', 'linear');
    expect(res.success).toBe(true);
    expect(res.data.symbol).toBe('BTCUSDT');
  });

  test('應該能下單(Stub)', async () => {
    const res = await rest.placeOrder({ symbol: 'BTCUSDT', side: 'buy', type: 'market', qty: '0.001' });
    expect(res.success).toBe(true);
    expect(res.data.orderId).toContain('bybit-');
  });
});
