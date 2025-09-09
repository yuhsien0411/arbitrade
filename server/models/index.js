/**
 * 數據庫模型統一導出
 */
const mongoose = require('mongoose');
const ArbitragePair = require('./ArbitragePair');
const Trade = require('./Trade');
const PriceData = require('./PriceData');

// 數據庫連接配置
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arbitrage_db';
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB 連接成功: ${conn.connection.host}`);
    
    // 設置連接事件監聽
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB 連接錯誤:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB 連接斷開');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB 重新連接成功');
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB 連接失敗:', error);
    // 測試環境避免直接退出
    if (process.env.NODE_ENV === 'test') {
      throw error;
    }
    process.exit(1);
  }
};

// 數據庫初始化
const initializeDB = async () => {
  try {
    await connectDB();
    
    // 創建索引
    await Promise.all([
      ArbitragePair.createIndexes(),
      Trade.createIndexes(),
      PriceData.createIndexes()
    ]);
    
    console.log('✅ 數據庫初始化完成');
  } catch (error) {
    console.error('❌ 數據庫初始化失敗:', error);
    throw error;
  }
};

// 數據庫清理
const cleanupDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ 數據庫連接已關閉');
  } catch (error) {
    console.error('❌ 關閉數據庫連接失敗:', error);
  }
};

module.exports = {
  // 模型
  ArbitragePair,
  Trade,
  PriceData,
  
  // 數據庫操作
  connectDB,
  initializeDB,
  cleanupDB,
  
  // 連接狀態
  isConnected: () => mongoose.connection.readyState === 1
};
