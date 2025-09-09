/**
 * 數據持久化服務
 * 提供統一的數據存儲接口，替換內存存儲
 */
const { ArbitragePair, Trade, PriceData } = require('../models');
const logger = require('../utils/logger');

class DataPersistenceService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * 初始化數據持久化服務
   */
  async initialize() {
    try {
      // 檢查數據庫連接
      if (!require('../models').isConnected()) {
        throw new Error('數據庫未連接');
      }

      this.isInitialized = true;
      logger.info('✅ 數據持久化服務初始化成功');
    } catch (error) {
      logger.error('❌ 數據持久化服務初始化失敗:', error);
      throw error;
    }
  }

  // ========== 套利交易對管理 ==========

  /**
   * 獲取所有套利交易對
   */
  async getArbitragePairs() {
    try {
      const pairs = await ArbitragePair.find().sort({ createdAt: -1 });
      return pairs;
    } catch (error) {
      logger.error('獲取套利交易對失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取活躍的套利交易對
   */
  async getActiveArbitragePairs() {
    try {
      const pairs = await ArbitragePair.findActivePairs();
      return pairs;
    } catch (error) {
      logger.error('獲取活躍套利交易對失敗:', error);
      throw error;
    }
  }

  /**
   * 創建新的套利交易對
   */
  async createArbitragePair(pairData) {
    try {
      const newPair = new ArbitragePair(pairData);
      await newPair.save();
      
      logger.info(`創建新的套利交易對: ${newPair.id}`);
      return newPair;
    } catch (error) {
      logger.error('創建套利交易對失敗:', error);
      throw error;
    }
  }

  /**
   * 更新套利交易對
   */
  async updateArbitragePair(id, updateData) {
    try {
      const updatedPair = await ArbitragePair.findOneAndUpdate(
        { id },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedPair) {
        throw new Error(`套利交易對不存在: ${id}`);
      }
      
      logger.info(`更新套利交易對: ${id}`);
      return updatedPair;
    } catch (error) {
      logger.error('更新套利交易對失敗:', error);
      throw error;
    }
  }

  /**
   * 刪除套利交易對
   */
  async deleteArbitragePair(id) {
    try {
      const deletedPair = await ArbitragePair.findOneAndDelete({ id });
      
      if (!deletedPair) {
        throw new Error(`套利交易對不存在: ${id}`);
      }
      
      logger.info(`刪除套利交易對: ${id}`);
      return deletedPair;
    } catch (error) {
      logger.error('刪除套利交易對失敗:', error);
      throw error;
    }
  }

  /**
   * 增加套利交易對觸發次數
   */
  async incrementArbitragePairTriggers(id) {
    try {
      const pair = await ArbitragePair.findOne({ id });
      if (!pair) {
        throw new Error(`套利交易對不存在: ${id}`);
      }
      
      await pair.incrementTriggers();
      return pair;
    } catch (error) {
      logger.error('增加套利交易對觸發次數失敗:', error);
      throw error;
    }
  }

  // ========== 交易記錄管理 ==========

  /**
   * 創建新的交易記錄
   */
  async createTrade(tradeData) {
    try {
      const newTrade = new Trade(tradeData);
      await newTrade.save();
      
      logger.info(`創建新的交易記錄: ${newTrade.tradeId}`);
      return newTrade;
    } catch (error) {
      logger.error('創建交易記錄失敗:', error);
      throw error;
    }
  }

  /**
   * 更新交易記錄
   */
  async updateTrade(tradeId, updateData) {
    try {
      const updatedTrade = await Trade.findOneAndUpdate(
        { tradeId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedTrade) {
        throw new Error(`交易記錄不存在: ${tradeId}`);
      }
      
      logger.info(`更新交易記錄: ${tradeId}`);
      return updatedTrade;
    } catch (error) {
      logger.error('更新交易記錄失敗:', error);
      throw error;
    }
  }

  /**
   * 更新交易腿狀態
   */
  async updateTradeLegStatus(tradeId, leg, status, executedAt = null) {
    try {
      const trade = await Trade.findOne({ tradeId });
      if (!trade) {
        throw new Error(`交易記錄不存在: ${tradeId}`);
      }
      
      await trade.updateLegStatus(leg, status, executedAt);
      return trade;
    } catch (error) {
      logger.error('更新交易腿狀態失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取交易記錄
   */
  async getTrades(filter = {}, options = {}) {
    try {
      const { limit = 50, offset = 0, sort = { createdAt: -1 } } = options;
      
      const trades = await Trade.find(filter)
        .sort(sort)
        .limit(limit)
        .skip(offset);
      
      const total = await Trade.countDocuments(filter);
      
      return {
        trades,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error('獲取交易記錄失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取交易統計
   */
  async getTradeStats(startDate, endDate) {
    try {
      const stats = await Trade.getProfitStats(startDate, endDate);
      return stats[0] || {
        totalTrades: 0,
        totalProfit: 0,
        averageProfit: 0,
        maxProfit: 0,
        minProfit: 0
      };
    } catch (error) {
      logger.error('獲取交易統計失敗:', error);
      throw error;
    }
  }

  // ========== 價格數據管理 ==========

  /**
   * 保存價格數據
   */
  async savePriceData(priceData) {
    try {
      const newPriceData = new PriceData(priceData);
      await newPriceData.save();
      return newPriceData;
    } catch (error) {
      // 如果是重複數據錯誤，忽略
      if (error.code === 11000) {
        return null;
      }
      logger.error('保存價格數據失敗:', error);
      throw error;
    }
  }

  /**
   * 批量保存價格數據
   */
  async savePriceDataBatch(priceDataArray) {
    try {
      if (priceDataArray.length === 0) return [];
      
      const result = await PriceData.insertMany(priceDataArray, { 
        ordered: false // 忽略重複數據錯誤
      });
      
      return result;
    } catch (error) {
      // 如果是批量插入錯誤，嘗試逐個插入
      if (error.name === 'BulkWriteError') {
        const results = [];
        for (const data of priceDataArray) {
          try {
            const result = await this.savePriceData(data);
            if (result) results.push(result);
          } catch (err) {
            // 忽略重複數據錯誤
            if (err.code !== 11000) {
              logger.error('保存單個價格數據失敗:', err);
            }
          }
        }
        return results;
      }
      
      logger.error('批量保存價格數據失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取最新價格數據
   */
  async getLatestPriceData(exchange, symbol) {
    try {
      const priceData = await PriceData.getLatestPrices(exchange, symbol);
      return priceData;
    } catch (error) {
      logger.error('獲取最新價格數據失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取價格歷史數據
   */
  async getPriceHistory(exchange, symbol, startTime, endTime) {
    try {
      const priceData = await PriceData.getPriceHistory(exchange, symbol, startTime, endTime);
      return priceData;
    } catch (error) {
      logger.error('獲取價格歷史數據失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取價差統計
   */
  async getSpreadStats(exchange, symbol, startTime, endTime) {
    try {
      const stats = await PriceData.calculateSpreadStats(exchange, symbol, startTime, endTime);
      return stats[0] || {
        averageSpread: 0,
        maxSpread: 0,
        minSpread: 0,
        averageSpreadPercentage: 0,
        dataPoints: 0
      };
    } catch (error) {
      logger.error('獲取價差統計失敗:', error);
      throw error;
    }
  }

  // ========== 系統統計 ==========

  /**
   * 獲取系統統計信息
   */
  async getSystemStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [
        totalPairs,
        activePairs,
        totalTrades,
        todayStats
      ] = await Promise.all([
        ArbitragePair.countDocuments(),
        ArbitragePair.countDocuments({ enabled: true }),
        Trade.countDocuments(),
        this.getTradeStats(today, tomorrow)
      ]);

      return {
        totalPairs,
        activePairs,
        totalTrades,
        todayTrades: todayStats.totalTrades,
        todayProfit: todayStats.totalProfit,
        averageProfit: todayStats.averageProfit
      };
    } catch (error) {
      logger.error('獲取系統統計失敗:', error);
      throw error;
    }
  }

  /**
   * 清理舊數據
   */
  async cleanupOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const [deletedPriceData, deletedTrades] = await Promise.all([
        PriceData.deleteMany({ timestamp: { $lt: cutoffDate } }),
        Trade.deleteMany({ 
          createdAt: { $lt: cutoffDate },
          status: { $in: ['completed', 'failed', 'cancelled'] }
        })
      ]);

      logger.info(`清理舊數據完成: 刪除 ${deletedPriceData.deletedCount} 條價格數據, ${deletedTrades.deletedCount} 條交易記錄`);
      
      return {
        deletedPriceData: deletedPriceData.deletedCount,
        deletedTrades: deletedTrades.deletedCount
      };
    } catch (error) {
      logger.error('清理舊數據失敗:', error);
      throw error;
    }
  }
}

module.exports = new DataPersistenceService();
