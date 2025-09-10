/**
 * 套利交易對模型
 * 定義套利交易對的數據結構和驗證規則
 */
const mongoose = require('mongoose');

const arbitragePairSchema = new mongoose.Schema({
  // 基本信息
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 第一腿交易配置
  leg1: {
    exchange: {
      type: String,
      required: true,
      enum: ['bybit', 'binance', 'okx', 'bitget']
    },
    symbol: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['spot', 'linear', 'inverse']
    },
    side: {
      type: String,
      required: true,
      enum: ['buy', 'sell']
    }
  },
  
  // 第二腿交易配置
  leg2: {
    exchange: {
      type: String,
      required: true,
      enum: ['bybit', 'binance', 'okx', 'bitget']
    },
    symbol: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['spot', 'linear', 'inverse']
    },
    side: {
      type: String,
      required: true,
      enum: ['buy', 'sell']
    }
  },
  
  // 套利配置
  threshold: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // 執行模式
  executionMode: {
    type: String,
    required: true,
    enum: ['threshold', 'twap', 'manual'],
    default: 'threshold'
  },
  
  // 狀態
  enabled: {
    type: Boolean,
    default: true
  },
  
  // 統計信息
  totalTriggers: {
    type: Number,
    default: 0
  },
  lastTriggered: {
    type: Date,
    default: null
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  
  // 時間戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'arbitrage_pairs'
});

// 索引
arbitragePairSchema.index({ 'leg1.exchange': 1, 'leg1.symbol': 1 });
arbitragePairSchema.index({ 'leg2.exchange': 1, 'leg2.symbol': 1 });
arbitragePairSchema.index({ enabled: 1 });
arbitragePairSchema.index({ createdAt: -1 });

// 虛擬字段
arbitragePairSchema.virtual('isActive').get(function() {
  return this.enabled && this.executionMode !== 'manual';
});

// 實例方法
arbitragePairSchema.methods.incrementTriggers = function() {
  this.totalTriggers += 1;
  this.lastTriggered = new Date();
  return this.save();
};

arbitragePairSchema.methods.addProfit = function(profit) {
  this.totalProfit += profit;
  return this.save();
};

// 靜態方法
arbitragePairSchema.statics.findActivePairs = function() {
  return this.find({ enabled: true });
};

arbitragePairSchema.statics.findByExchange = function(exchange) {
  return this.find({
    $or: [
      { 'leg1.exchange': exchange },
      { 'leg2.exchange': exchange }
    ]
  });
};

// 預保存中間件
arbitragePairSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ArbitragePair', arbitragePairSchema);
