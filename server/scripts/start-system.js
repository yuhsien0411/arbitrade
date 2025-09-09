/**
 * 系統啟動腳本
 * 初始化數據庫、運行遷移、啟動服務
 */
const { initializeDB, cleanupDB } = require('../models');
const MigrationManager = require('../migrations/migrate');
const DataPersistenceService = require('../services/DataPersistenceService');
const { getArbitrageEngine } = require('../services/arbitrageEngine');
const logger = require('../utils/logger');

class SystemStarter {
  constructor() {
    this.isInitialized = false;
    this.migrationManager = new MigrationManager();
  }

  /**
   * 啟動系統
   */
  async start() {
    try {
      console.log('🚀 正在啟動 Arbitrage 系統...');
      
      // 1. 初始化數據庫
      console.log('📊 初始化數據庫...');
      await initializeDB();
      
      // 2. 運行數據庫遷移
      console.log('🔄 運行數據庫遷移...');
      await this.migrationManager.runMigrations();
      
      // 3. 初始化數據持久化服務
      console.log('💾 初始化數據持久化服務...');
      await DataPersistenceService.initialize();
      
      // 4. 啟動套利引擎
      console.log('⚙️ 啟動套利引擎...');
      const engine = getArbitrageEngine();
      await engine.start();
      
      this.isInitialized = true;
      console.log('✅ 系統啟動完成！');
      
      // 5. 顯示系統狀態
      await this.showSystemStatus();
      
    } catch (error) {
      console.error('❌ 系統啟動失敗:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * 停止系統
   */
  async stop() {
    try {
      console.log('🛑 正在停止系統...');
      
      // 停止套利引擎
      const engine = getArbitrageEngine();
      if (engine) {
        await engine.stop();
      }
      
      // 清理數據庫連接
      await cleanupDB();
      
      this.isInitialized = false;
      console.log('✅ 系統已停止');
      
    } catch (error) {
      console.error('❌ 系統停止失敗:', error);
    }
  }

  /**
   * 顯示系統狀態
   */
  async showSystemStatus() {
    try {
      console.log('\n📊 系統狀態:');
      
      // 數據庫狀態
      const { isConnected } = require('../models');
      console.log(`  數據庫: ${isConnected() ? '✅ 已連接' : '❌ 未連接'}`);
      
      // 套利引擎狀態
      const engine = getArbitrageEngine();
      if (engine) {
        const status = engine.getStatus();
        console.log(`  套利引擎: ${status.isRunning ? '✅ 運行中' : '❌ 已停止'}`);
        console.log(`  總交易數: ${status.totalTrades}`);
        console.log(`  總利潤: ${status.totalProfit}`);
      }
      
      // 數據統計
      const stats = await DataPersistenceService.getSystemStats();
      console.log(`  套利交易對: ${stats.totalPairs} (活躍: ${stats.activePairs})`);
      console.log(`  交易記錄: ${stats.totalTrades}`);
      console.log(`  今日利潤: ${stats.todayProfit}`);
      
      console.log('\n🎉 系統運行正常！');
      
    } catch (error) {
      console.error('❌ 獲取系統狀態失敗:', error);
    }
  }

  /**
   * 清理資源
   */
  async cleanup() {
    try {
      if (this.isInitialized) {
        await this.stop();
      }
    } catch (error) {
      console.error('❌ 清理資源失敗:', error);
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck() {
    try {
      const checks = {
        database: false,
        arbitrageEngine: false,
        dataPersistence: false
      };
      
      // 檢查數據庫
      const { isConnected } = require('../models');
      checks.database = isConnected();
      
      // 檢查套利引擎
      const engine = getArbitrageEngine();
      if (engine) {
        const status = engine.getStatus();
        checks.arbitrageEngine = status.isRunning;
      }
      
      // 檢查數據持久化服務
      checks.dataPersistence = this.isInitialized;
      
      const allHealthy = Object.values(checks).every(check => check);
      
      return {
        healthy: allHealthy,
        checks,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 命令行執行
if (require.main === module) {
  const starter = new SystemStarter();
  
  // 處理進程信號
  process.on('SIGINT', async () => {
    console.log('\n🛑 收到停止信號...');
    await starter.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 收到終止信號...');
    await starter.stop();
    process.exit(0);
  });
  
  // 啟動系統
  starter.start().catch(async (error) => {
    console.error('❌ 系統啟動失敗:', error);
    await starter.cleanup();
    process.exit(1);
  });
}

module.exports = SystemStarter;
