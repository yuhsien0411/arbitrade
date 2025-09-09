/**
 * Binance 交易所使用示例
 * 展示如何使用 Binance 交易所進行基本的交易操作
 */

const ExchangeFactory = require('../index');
const logger = require('../../utils/logger');

async function binanceExample() {
  try {
    // 1. 創建 Binance 交易所實例
    logger.info('創建 Binance 交易所實例...');
    const binance = ExchangeFactory.createExchange('binance', {
      name: 'Binance',
      apiKey: process.env.BINANCE_API_KEY || 'test-api-key',
      secret: process.env.BINANCE_SECRET || 'test-secret',
      testnet: true  // 使用測試網
    });

    // 2. 初始化交易所
    logger.info('初始化交易所...');
    await binance.initialize();
    logger.info('交易所初始化成功');

    // 3. 獲取市場數據
    logger.info('獲取市場數據...');
    
    // 獲取 BTC/USDT 行情
    const ticker = await binance.getTicker('BTCUSDT');
    logger.info(`BTC/USDT 價格: $${ticker.price}`);
    logger.info(`24小時變化: ${ticker.change}%`);

    // 獲取訂單簿
    const orderBook = await binance.getOrderBook('BTCUSDT', 10);
    logger.info(`最佳買價: $${orderBook.bids[0][0]} (數量: ${orderBook.bids[0][1]})`);
    logger.info(`最佳賣價: $${orderBook.asks[0][0]} (數量: ${orderBook.asks[0][1]})`);

    // 獲取交易對列表
    const instruments = await binance.getInstruments('spot');
    logger.info(`支持的交易對數量: ${instruments.length}`);

    // 4. 獲取賬戶信息
    logger.info('獲取賬戶信息...');
    const accountInfo = await binance.getAccountInfo();
    logger.info('賬戶信息:', accountInfo);

    // 5. WebSocket 訂閱示例
    logger.info('設置 WebSocket 訂閱...');
    
    // 訂閱行情數據
    binance.subscribeTicker('BTCUSDT');
    binance.on('ticker', (data) => {
      logger.info(`[WebSocket] ${data.symbol} 價格更新: $${data.price}`);
    });

    // 訂閱訂單簿
    binance.subscribeOrderBook('BTCUSDT');
    binance.on('orderbook', (data) => {
      logger.info(`[WebSocket] ${data.symbol} 訂單簿更新`);
    });

    // 訂閱交易數據
    binance.subscribeTrades('BTCUSDT');
    binance.on('trade', (data) => {
      logger.info(`[WebSocket] ${data.symbol} 新交易: $${data.price} (${data.quantity})`);
    });

    // 6. 交易操作示例（僅在測試網環境下）
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
      logger.info('執行交易操作示例...');
      
      try {
        // 下一個小額測試訂單
        const order = await binance.placeOrder({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'limit',
          amount: 0.001,
          price: ticker.price * 0.9  // 以當前價格的90%下單
        });
        logger.info(`測試訂單下單成功: ${order.id}`);

        // 等待一段時間後取消訂單
        setTimeout(async () => {
          try {
            await binance.cancelOrder(order.id, 'BTCUSDT');
            logger.info(`測試訂單取消成功: ${order.id}`);
          } catch (error) {
            logger.error('取消訂單失敗:', error.message);
          }
        }, 5000);

      } catch (error) {
        logger.error('交易操作失敗:', error.message);
      }
    } else {
      logger.info('跳過交易操作（需要真實的 API 密鑰）');
    }

    // 7. 獲取統計信息
    const stats = binance.getStats();
    logger.info('交易所統計信息:', stats);

    // 8. 保持連接一段時間以觀察 WebSocket 數據
    logger.info('保持連接 30 秒以觀察 WebSocket 數據...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 9. 清理資源
    logger.info('清理資源...');
    await binance.cleanup();
    logger.info('示例完成');

  } catch (error) {
    logger.error('示例執行失敗:', error);
  }
}

// 錯誤處理示例
async function errorHandlingExample() {
  try {
    const binance = ExchangeFactory.createExchange('binance', {
      name: 'Binance',
      apiKey: 'invalid-key',
      secret: 'invalid-secret',
      testnet: true
    });

    await binance.initialize();
  } catch (error) {
    logger.error('預期的錯誤:', error.message);
    
    // 檢查錯誤類型
    if (error.message.includes('API key')) {
      logger.info('這是 API 密鑰錯誤');
    } else if (error.message.includes('network')) {
      logger.info('這是網絡錯誤');
    }
  }
}

// 批量操作示例
async function batchOperationsExample() {
  try {
    const binance = ExchangeFactory.createExchange('binance', {
      name: 'Binance',
      apiKey: process.env.BINANCE_API_KEY || 'test-api-key',
      secret: process.env.BINANCE_SECRET || 'test-secret',
      testnet: true
    });

    await binance.initialize();

    // 批量獲取多個交易對的行情
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    const tickers = [];

    for (const symbol of symbols) {
      try {
        const ticker = await binance.getTicker(symbol);
        tickers.push(ticker);
        logger.info(`${symbol}: $${ticker.price}`);
      } catch (error) {
        logger.error(`獲取 ${symbol} 行情失敗:`, error.message);
      }
    }

    logger.info(`成功獲取 ${tickers.length} 個交易對的行情`);

    // 批量訂閱 WebSocket
    for (const symbol of symbols) {
      binance.subscribeTicker(symbol);
    }

    logger.info(`已訂閱 ${symbols.length} 個交易對的 WebSocket 數據`);

    await binance.cleanup();

  } catch (error) {
    logger.error('批量操作示例失敗:', error);
  }
}

// 如果直接運行此文件
if (require.main === module) {
  // 設置環境變量（僅用於演示）
  if (!process.env.BINANCE_API_KEY) {
    logger.info('注意：未設置 BINANCE_API_KEY 環境變量，將使用測試配置');
  }

  // 運行示例
  binanceExample()
    .then(() => {
      logger.info('基本示例完成');
      return errorHandlingExample();
    })
    .then(() => {
      logger.info('錯誤處理示例完成');
      return batchOperationsExample();
    })
    .then(() => {
      logger.info('批量操作示例完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('示例執行失敗:', error);
      process.exit(1);
    });
}

module.exports = {
  binanceExample,
  errorHandlingExample,
  batchOperationsExample
};
