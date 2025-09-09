/**
 * 初始數據庫遷移腳本
 * 創建初始的套利交易對數據
 */
const { ArbitragePair, Trade, PriceData } = require('../models');

const initialArbitragePairs = [
  {
    id: 'test_pair_1',
    leg1: { 
      exchange: 'bybit', 
      symbol: 'BTCUSDT', 
      type: 'linear',
      side: 'buy' 
    },
    leg2: { 
      exchange: 'bybit', 
      symbol: 'BTCUSDT', 
      type: 'linear',
      side: 'sell' 
    },
    threshold: 0.1,
    amount: 50,
    enabled: true,
    executionMode: 'threshold',
    totalTriggers: 0,
    lastTriggered: null,
    totalProfit: 0
  },
  {
    id: 'test_pair_2',
    leg1: { 
      exchange: 'bybit', 
      symbol: 'BTCUSDT', 
      type: 'spot',
      side: 'buy' 
    },
    leg2: { 
      exchange: 'bybit', 
      symbol: 'BTCUSDT', 
      type: 'linear',
      side: 'sell' 
    },
    threshold: 0.15,
    amount: 0.01,
    enabled: true,
    executionMode: 'threshold',
    totalTriggers: 0,
    lastTriggered: null,
    totalProfit: 0
  }
];

const runMigration = async () => {
  try {
    console.log('🚀 開始執行初始數據庫遷移...');
    
    // 檢查是否已有數據
    const existingPairs = await ArbitragePair.countDocuments();
    if (existingPairs > 0) {
      console.log('⚠️ 數據庫中已存在套利交易對，跳過初始數據創建');
      return;
    }
    
    // 創建初始套利交易對
    console.log('📝 創建初始套利交易對...');
    const createdPairs = await ArbitragePair.insertMany(initialArbitragePairs);
    console.log(`✅ 成功創建 ${createdPairs.length} 個套利交易對`);
    
    // 顯示創建的數據
    createdPairs.forEach(pair => {
      console.log(`  - ${pair.id}: ${pair.leg1.exchange}/${pair.leg1.symbol} ${pair.leg1.side} ↔ ${pair.leg2.exchange}/${pair.leg2.symbol} ${pair.leg2.side}`);
    });
    
    console.log('✅ 初始數據庫遷移完成');
    
  } catch (error) {
    console.error('❌ 數據庫遷移失敗:', error);
    throw error;
  }
};

const rollbackMigration = async () => {
  try {
    console.log('🔄 開始回滾初始數據庫遷移...');
    
    // 刪除初始套利交易對
    const result = await ArbitragePair.deleteMany({
      id: { $in: initialArbitragePairs.map(pair => pair.id) }
    });
    
    console.log(`✅ 成功刪除 ${result.deletedCount} 個套利交易對`);
    console.log('✅ 初始數據庫遷移回滾完成');
    
  } catch (error) {
    console.error('❌ 數據庫遷移回滾失敗:', error);
    throw error;
  }
};

module.exports = {
  run: runMigration,
  rollback: rollbackMigration,
  description: '創建初始的套利交易對數據'
};
