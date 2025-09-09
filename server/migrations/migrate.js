/**
 * 數據庫遷移管理器
 * 執行和管理數據庫遷移腳本
 */
const { initializeDB, cleanupDB } = require('../models');
const migration001 = require('./001_initial_migration');

const migrations = [
  {
    id: '001_initial_migration',
    description: '創建初始的套利交易對數據',
    run: migration001.run,
    rollback: migration001.rollback
  }
];

class MigrationManager {
  constructor() {
    this.migrations = migrations;
  }

  /**
   * 執行所有待執行的遷移
   */
  async runMigrations() {
    try {
      console.log('🚀 開始執行數據庫遷移...');
      
      await initializeDB();
      
      for (const migration of this.migrations) {
        console.log(`\n📝 執行遷移: ${migration.id}`);
        console.log(`   描述: ${migration.description}`);
        
        await migration.run();
        console.log(`✅ 遷移 ${migration.id} 執行成功`);
      }
      
      console.log('\n🎉 所有數據庫遷移執行完成');
      
    } catch (error) {
      console.error('❌ 數據庫遷移執行失敗:', error);
      throw error;
    } finally {
      await cleanupDB();
    }
  }

  /**
   * 回滾最後一個遷移
   */
  async rollbackLastMigration() {
    try {
      console.log('🔄 開始回滾最後一個遷移...');
      
      await initializeDB();
      
      const lastMigration = this.migrations[this.migrations.length - 1];
      console.log(`📝 回滾遷移: ${lastMigration.id}`);
      console.log(`   描述: ${lastMigration.description}`);
      
      await lastMigration.rollback();
      console.log(`✅ 遷移 ${lastMigration.id} 回滾成功`);
      
    } catch (error) {
      console.error('❌ 數據庫遷移回滾失敗:', error);
      throw error;
    } finally {
      await cleanupDB();
    }
  }

  /**
   * 列出所有可用的遷移
   */
  listMigrations() {
    console.log('📋 可用的數據庫遷移:');
    this.migrations.forEach((migration, index) => {
      console.log(`  ${index + 1}. ${migration.id}`);
      console.log(`     描述: ${migration.description}`);
    });
  }
}

// 命令行執行
if (require.main === module) {
  const manager = new MigrationManager();
  const command = process.argv[2];

  switch (command) {
    case 'run':
      manager.runMigrations().catch(console.error);
      break;
    case 'rollback':
      manager.rollbackLastMigration().catch(console.error);
      break;
    case 'list':
      manager.listMigrations();
      break;
    default:
      console.log('使用方法:');
      console.log('  node migrate.js run      - 執行所有遷移');
      console.log('  node migrate.js rollback - 回滾最後一個遷移');
      console.log('  node migrate.js list     - 列出所有遷移');
  }
}

module.exports = MigrationManager;
