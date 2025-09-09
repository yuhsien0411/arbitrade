const BaseRest = require('../base/BaseRest');
const logger = require('../../utils/logger');

class BybitRest extends BaseRest {
  constructor(config) {
    super(config);
    this.baseUrl = config?.testnet
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';
  }

  async initialize() {
    // 無外部 SDK，標記為可用
    logger.info('[BybitRest] 已初始化');
    return true;
  }

  async request(method, endpoint, params = {}, headers = {}) {
    // 測試/本地環境下提供 stub 響應
    // 真實情境應該使用 axios/fetch 並簽名
    this.incrementRequestCount();
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }
    const url = `${this.baseUrl}/${endpoint}`.replace(/\/+/, '/');
    logger.debug?.(`[BybitRest] ${method} ${url}`, { params, headers });

    // 簡單模擬成功回應
    return { code: 0, retCode: 0, result: { ok: true } };
  }

  // 常用便捷方法（示例）
  async getOrderBook(symbol, category = 'linear') {
    const res = await this.get('v5/market/orderbook', { symbol, category, limit: 25 });
    return {
      success: true,
      data: {
        symbol,
        bids: [['50000', '1.0']],
        asks: [['50010', '1.2']],
        timestamp: Date.now()
      }
    };
  }

  async getTickers(items) {
    // items: [{ symbol, category }]
    return {
      success: true,
      data: items.map(i => ({ symbol: i.symbol, price: 50000 + Math.random() * 100 }))
    };
  }

  async placeOrder(orderParams) {
    await this.post('v5/order/create', orderParams);
    return { success: true, data: { orderId: `bybit-${Date.now()}` } };
  }

  async cancelOrder(symbol, orderId, category = 'linear') {
    await this.post('v5/order/cancel', { symbol, orderId, category });
    return { success: true, data: { orderId } };
  }
}

module.exports = BybitRest;
