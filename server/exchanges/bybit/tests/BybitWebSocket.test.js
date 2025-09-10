const BybitWebSocket = require('../BybitWebSocket');

describe('BybitWebSocket', () => {
  let ws;

  beforeEach(() => {
    ws = new BybitWebSocket({});
  });

  test('應該能連線與斷線', async () => {
    await ws.connect();
    expect(ws.isWSConnected()).toBe(true);
    await ws.disconnect();
    expect(ws.isWSConnected()).toBe(false);
  });

  test('應該能訂閱與取消訂閱', async () => {
    await ws.connect();
    await ws.subscribe('tickers.BTCUSDT');
    expect(ws.getSubscriptions()).toContain('tickers.BTCUSDT');
    await ws.unsubscribe('tickers.BTCUSDT');
    expect(ws.getSubscriptions()).not.toContain('tickers.BTCUSDT');
  });
});

