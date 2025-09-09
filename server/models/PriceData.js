/**
 * 價格數據模型
 * 存儲實時價格數據用於歷史分析和回測
 */
const mongoose = require('mongoose');

const priceDataSchema = new mongoose.Schema({
  // 基本信息
  exchange: {
    type: String,
    required: true,
    enum: ['bybit', 'binance', 'okx', 'bitget']
  },
  
  symbol: {
    type: String,
    required: true
  },
  
  // 價格數據
  bid: {
    price: {
      type: Number,
      required: true
    },
    size: {
      type: Number,
      required: true
    }
  },
  
  ask: {
    price: {
      type: Number,
      required: true
    },
    size: {
      type: Number,
      required: true
    }
  },
  
  // 中間價
  midPrice: {
    type: Number,
    required: true
  },
  
  // 價差
  spread: {
    type: Number,
    required: true
  },
  
  // 價差百分比
  spreadPercentage: {
    type: Number,
    required: true
  },
  
  // 時間戳
  timestamp: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: false,
  collection: 'price_data'
});

// 索引
priceDataSchema.index({ exchange: 1, symbol: 1, timestamp: -1 });
priceDataSchema.index({ timestamp: -1 });
priceDataSchema.index({ exchange: 1, symbol: 1, timestamp: 1 }, { unique: true });

// 靜態方法
priceDataSchema.statics.getLatestPrices = function(exchange, symbol) {
  return this.findOne({ exchange, symbol })
    .sort({ timestamp: -1 });
};

priceDataSchema.statics.getPriceHistory = function(exchange, symbol, startTime, endTime) {
  return this.find({
    exchange,
    symbol,
    timestamp: {
      $gte: startTime,
      $lte: endTime
    }
  }).sort({ timestamp: 1 });
};

priceDataSchema.statics.getPriceRange = function(exchange, symbol, limit = 100) {
  return this.find({ exchange, symbol })
    .sort({ timestamp: -1 })
    .limit(limit);
};

priceDataSchema.statics.calculateSpreadStats = function(exchange, symbol, startTime, endTime) {
  return this.aggregate([
    {
      $match: {
        exchange,
        symbol,
        timestamp: {
          $gte: startTime,
          $lte: endTime
        }
      }
    },
    {
      $group: {
        _id: null,
        averageSpread: { $avg: '$spread' },
        maxSpread: { $max: '$spread' },
        minSpread: { $min: '$spread' },
        averageSpreadPercentage: { $avg: '$spreadPercentage' },
        dataPoints: { $sum: 1 }
      }
    }
  ]);
};

// 預保存中間件
priceDataSchema.pre('save', function(next) {
  // 計算中間價
  this.midPrice = (this.bid.price + this.ask.price) / 2;
  
  // 計算價差
  this.spread = this.ask.price - this.bid.price;
  
  // 計算價差百分比
  this.spreadPercentage = (this.spread / this.midPrice) * 100;
  
  next();
});

module.exports = mongoose.model('PriceData', priceDataSchema);
