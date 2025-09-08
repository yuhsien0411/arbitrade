/**
 * 使用示例 - 展示如何使用新的交易所抽象層
 */

const ExchangeFactory = require('../exchanges/index');
const TradingError = require('../utils/TradingError');

async function example() {
  try {
    console.log('🚀 交易所抽象層使用示例');
    
    // 1. 創建交易所配置
    const bybitConfig = {
      name: 'Bybit',
      apiKey: process.env.BYBIT_API_KEY || 'your_api_key',
      secret: process.env.BYBIT_SECRET || 'your_secret',
      testnet: false
    };
    
    // 2. 使用工廠創建交易所實例
    console.log('📦 創建 Bybit 交易所實例...');
    const bybitExchange = ExchangeFactory.createExchange('bybit', bybitConfig);
    
    // 3. 獲取交易所狀態
    console.log('📊 交易所狀態:', {
      name: bybitExchange.getExchangeName(),
      connected: bybitExchange.isExchangeConnected(),
      stats: bybitExchange.getStats()
    });
    
    // 4. 獲取所有交易所狀態
    console.log('📈 所有交易所狀態:', ExchangeFactory.getStatus());
    
    // 5. 錯誤處理示例
    try {
      ExchangeFactory.createExchange('unsupported', {});
    } catch (error) {
      if (error instanceof TradingError) {
        console.log('❌ 捕獲交易錯誤:', error.toString());
        console.log('📋 錯誤詳情:', error.toJSON());
      }
    }
    
    // 6. 清理資源
    console.log('🧹 清理資源...');
    await ExchangeFactory.cleanupAll();
    
    console.log('✅ 示例完成');
    
  } catch (error) {
    console.error('❌ 示例執行失敗:', error);
  }
}

// 如果直接運行此文件
if (require.main === module) {
  example();
}

module.exports = example;
