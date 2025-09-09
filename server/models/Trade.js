/**
 * 交易記錄模型
 * 記錄所有套利交易的詳細信息
 */
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  // 基本信息
  tradeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 關聯的套利對
  arbitragePairId: {
    type: String,
    required: true,
    index: true
  },
  
  // 交易類型
  tradeType: {
    type: String,
    required: true,
    enum: ['arbitrage', 'twap', 'manual']
  },
  
  // 第一腿交易
  leg1: {
    exchange: {
      type: String,
      required: true
    },
    symbol: {
      type: String,
      required: true
    },
    side: {
      type: String,
      required: true,
      enum: ['buy', 'sell']
    },
    orderId: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    fee: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'filled', 'cancelled', 'failed'],
      default: 'pending'
    },
    executedAt: {
      type: Date,
      default: null
    }
  },
  
  // 第二腿交易
  leg2: {
    exchange: {
      type: String,
      required: true
    },
    symbol: {
      type: String,
      required: true
    },
    side: {
      type: String,
      required: true,
      enum: ['buy', 'sell']
    },
    orderId: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    fee: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'filled', 'cancelled', 'failed'],
      default: 'pending'
    },
    executedAt: {
      type: Date,
      default: null
    }
  },
  
  // 套利結果
  priceDifference: {
    type: Number,
    required: true
  },
  expectedProfit: {
    type: Number,
    required: true
  },
  actualProfit: {
    type: Number,
    default: 0
  },
  totalFees: {
    type: Number,
    default: 0
  },
  netProfit: {
    type: Number,
    default: 0
  },
  
  // 交易狀態
  status: {
    type: String,
    required: true,
    enum: ['pending', 'partial', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // 錯誤信息
  error: {
    type: String,
    default: null
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
  collection: 'trades'
});

// 索引
tradeSchema.index({ arbitragePairId: 1, createdAt: -1 });
tradeSchema.index({ status: 1 });
tradeSchema.index({ tradeType: 1 });
tradeSchema.index({ 'leg1.exchange': 1, 'leg1.symbol': 1 });
tradeSchema.index({ 'leg2.exchange': 1, 'leg2.symbol': 1 });

// 虛擬字段
tradeSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed' && 
         this.leg1.status === 'filled' && 
         this.leg2.status === 'filled';
});

tradeSchema.virtual('isProfitable').get(function() {
  return this.netProfit > 0;
});

// 實例方法
tradeSchema.methods.updateLegStatus = function(leg, status, executedAt = null) {
  if (leg === 1) {
    this.leg1.status = status;
    if (executedAt) this.leg1.executedAt = executedAt;
  } else if (leg === 2) {
    this.leg2.status = status;
    if (executedAt) this.leg2.executedAt = executedAt;
  }
  
  // 更新整體狀態
  this.updateOverallStatus();
  return this.save();
};

tradeSchema.methods.updateOverallStatus = function() {
  if (this.leg1.status === 'filled' && this.leg2.status === 'filled') {
    this.status = 'completed';
    this.calculateActualProfit();
  } else if (this.leg1.status === 'failed' || this.leg2.status === 'failed') {
    this.status = 'failed';
  } else if (this.leg1.status === 'cancelled' || this.leg2.status === 'cancelled') {
    this.status = 'cancelled';
  } else if (this.leg1.status === 'filled' || this.leg2.status === 'filled') {
    this.status = 'partial';
  }
};

tradeSchema.methods.calculateActualProfit = function() {
  if (this.leg1.status === 'filled' && this.leg2.status === 'filled') {
    // 計算實際利潤
    const leg1Value = this.leg1.side === 'buy' ? 
      -(this.leg1.price * this.leg1.quantity) : 
      (this.leg1.price * this.leg1.quantity);
    
    const leg2Value = this.leg2.side === 'buy' ? 
      -(this.leg2.price * this.leg2.quantity) : 
      (this.leg2.price * this.leg2.quantity);
    
    this.actualProfit = leg1Value + leg2Value;
    this.totalFees = this.leg1.fee + this.leg2.fee;
    this.netProfit = this.actualProfit - this.totalFees;
  }
};

// 靜態方法
tradeSchema.statics.findByArbitragePair = function(pairId) {
  return this.find({ arbitragePairId: pairId }).sort({ createdAt: -1 });
};

tradeSchema.statics.findCompletedTrades = function() {
  return this.find({ status: 'completed' });
};

tradeSchema.statics.getProfitStats = function(startDate, endDate) {
  const matchStage = {
    status: 'completed',
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        totalProfit: { $sum: '$netProfit' },
        averageProfit: { $avg: '$netProfit' },
        maxProfit: { $max: '$netProfit' },
        minProfit: { $min: '$netProfit' }
      }
    }
  ]);
};

// 預保存中間件
tradeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Trade', tradeSchema);
