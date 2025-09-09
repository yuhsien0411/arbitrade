// /**
//  * Bybit 兼容性適配器
//  * 提供與現有 bybitService.js 相同的接口，確保向後兼容性
//  */
// const BybitExchange = require('./BybitExchange');
// const ExchangeFactory = require('../index');
// const logger = require('../../utils/logger');

// class BybitCompatibilityAdapter {
//   constructor() {
//     this.exchange = null;
//     this.isInitialized = false;
//   }

//   /**
//    * 初始化（兼容現有接口）
//    */
//   async initialize() {
//     try {
//       // 冪等處理：若已初始化，直接返回 true
//       if (this.isInitialized && this.exchange) {
//         return true;
//       }

//       const apiKey = process.env.BYBIT_API_KEY;
//       const apiSecret = process.env.BYBIT_SECRET;
//       const testnet = process.env.BYBIT_TESTNET === 'true';

//       if (!apiKey || !apiSecret) {
//         logger.error('Bybit API密鑰未配置');
//         this.isInitialized = false;
//         return false;
//       }

//       // 使用工廠創建交易所實例（若尚未創建）
//       if (!this.exchange) {
//         this.exchange = ExchangeFactory.createExchange('bybit', {
//           name: 'Bybit',
//           apiKey: apiKey,
//           secret: apiSecret,
//           testnet: testnet
//         });
//       }

//       // 初始化交易所
//       const success = await this.exchange.initialize();
//       this.isInitialized = success;
//       if (success) {
//         logger.info('[BybitCompatibilityAdapter] 初始化成功');
//       } else {
//         logger.error('[BybitCompatibilityAdapter] 初始化失敗');
//       }

//       return success;
//     } catch (error) {
//       logger.error('[BybitCompatibilityAdapter] 初始化失敗:', error);
//       this.isInitialized = false;
//       return false;
//     }
//   }

//   /**
//    * 獲取賬戶信息（兼容現有接口）
//    */
//   async getAccountInfo() {
//     if (!this.exchange) {
//       return {
//         success: false,
//         error: '交易所未初始化'
//       };
//     }

//     return await this.exchange.getAccountInfo();
//   }

//   /**
//    * 獲取交易對信息（兼容現有接口）
//    */
//   async getInstruments(category = 'linear') {
//     if (!this.exchange) {
//       return {
//         success: false,
//         error: '交易所未初始化'
//       };
//     }

//     return await this.exchange.getInstruments(category);
//   }

//   /**
//    * 獲取訂單簿數據（兼容現有接口）
//    */
//   async getOrderBook(symbol, category = 'linear') {
//     if (!this.exchange) {
//       return {
//         success: false,
//         error: '交易所未初始化'
//       };
//     }

//     return await this.exchange.getOrderBook(symbol, category);
//   }

//   /**
//    * 下單（兼容現有接口）
//    */
//   async placeOrder(orderParams) {
//     if (!this.exchange) {
//       return {
//         success: false,
//         error: '交易所未初始化'
//       };
//     }

//     return await this.exchange.placeOrder(orderParams);
//   }

//   /**
//    * 取消訂單（兼容現有接口）
//    */
//   async cancelOrder(symbol, orderId, category = 'linear') {
//     if (!this.exchange) {
//       return {
//         success: false,
//         error: '交易所未初始化'
//       };
//     }

//     return await this.exchange.cancelOrder(symbol, orderId, category);
//   }

//   /**
//    * 獲取訂單歷史（兼容現有接口）
//    */
//   async getOrders(symbol, category = 'linear') {
//     if (!this.exchange) {
//       return {
//         success: false,
//         error: '交易所未初始化'
//       };
//     }

//     try {
//       const response = await this.exchange.restClient.get('order/realtime', {
//         category: category,
//         symbol: symbol
//       });

//       return {
//         success: true,
//         data: response?.list || []
//       };
//     } catch (error) {
//       logger.error('[BybitCompatibilityAdapter] 獲取訂單歷史失敗:', error);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * 訂閱價格數據（兼容現有接口）
//    */
//   subscribeToOrderBook(symbols) {
//     if (!this.exchange || !this.exchange.wsClient) {
//       logger.error('WebSocket客戶端未初始化');
//       return;
//     }

//     try {
//       symbols.forEach(symbol => {
//         this.exchange.wsClient.subscribe(`orderbook.25.${symbol}`, { category: 'linear' });
//       });

//       logger.info(`已訂閱價格數據: ${symbols.join(', ')}`);
//     } catch (error) {
//       logger.error('訂閱價格數據失敗:', error);
//     }
//   }

//   /**
//    * 訂閱 tickers（兼容現有接口）
//    */
//   subscribeToTickers(items, defaultCategory = 'linear') {
//     if (!this.exchange) {
//       logger.error('交易所未初始化');
//       return;
//     }

//     return this.exchange.subscribeToTickers(items);
//   }

//   /**
//    * 獲取頂部報價（兼容現有接口）
//    */
//   getTopOfBook(symbol) {
//     if (!this.exchange) {
//       return null;
//     }

//     return this.exchange.getTopOfBook(symbol);
//   }

//   /**
//    * 測試API連接（兼容現有接口）
//    */
//   async testConnection() {
//     if (!this.exchange) {
//       return {
//         success: false,
//         message: '交易所未初始化'
//       };
//     }

//     return await this.exchange.testConnection();
//   }

//   /**
//    * 斷開連接（兼容現有接口）
//    */
//   disconnect() {
//     if (this.exchange) {
//       this.exchange.cleanup();
//       this.exchange = null;
//     }
//     this.isInitialized = false;
//     logger.info('Bybit服務已斷開連接');
//   }

//   /**
//    * 獲取連接狀態（兼容現有接口）
//    */
//   get isConnected() {
//     return this.exchange ? this.exchange.isExchangeConnected() : false;
//   }

//   /**
//    * 獲取統計信息（新增功能）
//    */
//   getStats() {
//     if (!this.exchange) {
//       return null;
//     }

//     return this.exchange.getStats();
//   }

//   /**
//    * 獲取交易所名稱（新增功能）
//    */
//   getExchangeName() {
//     return 'Bybit';
//   }
// }

// // 導出單例實例，保持與現有代碼的兼容性
// module.exports = new BybitCompatibilityAdapter();
