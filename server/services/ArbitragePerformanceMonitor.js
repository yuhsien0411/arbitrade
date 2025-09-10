/**
 * 套利性能監控系統
 * 監控套利系統的各種性能指標
 */
const logger = require('../utils/logger');

class ArbitragePerformanceMonitor {
  constructor() {
    this.metrics = {
      // 套利統計
      totalArbitrages: 0,
      successfulArbitrages: 0,
      failedArbitrages: 0,
      
      // 性能指標
      averageExecutionTime: 0,
      averageDetectionTime: 0,
      averageAPIResponseTime: 0,
      
      // API 響應時間
      apiResponseTimes: new Map(),
      
      // 錯誤統計
      errorRates: new Map(),
      
      // 利潤統計
      totalProfit: 0,
      todayProfit: 0,
      averageProfit: 0,
      
      // 系統資源
      memoryUsage: [],
      cpuUsage: [],
      
      // 時間戳
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * 開始監控
   */
  startMonitoring(interval = 5000) {
    if (this.isMonitoring) {
      logger.warn('性能監控已經在運行中');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, interval);

    logger.info('性能監控已啟動');
  }

  /**
   * 停止監控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('性能監控已停止');
  }

  /**
   * 記錄套利執行
   */
  recordArbitrageExecution(success, executionTime, profit = 0) {
    this.metrics.totalArbitrages++;
    
    if (success) {
      this.metrics.successfulArbitrages++;
      this.metrics.totalProfit += profit;
      this.metrics.todayProfit += profit;
    } else {
      this.metrics.failedArbitrages++;
    }
    
    // 更新平均執行時間
    this.updateAverageExecutionTime(executionTime);
    
    // 更新平均利潤
    this.updateAverageProfit();
    
    logger.debug(`套利執行記錄: 成功=${success}, 時間=${executionTime}ms, 利潤=${profit}`);
  }

  /**
   * 記錄 API 響應時間
   */
  recordAPIResponseTime(exchange, endpoint, responseTime) {
    const key = `${exchange}-${endpoint}`;
    
    if (!this.metrics.apiResponseTimes.has(key)) {
      this.metrics.apiResponseTimes.set(key, []);
    }
    
    const times = this.metrics.apiResponseTimes.get(key);
    times.push(responseTime);
    
    // 只保留最近 100 次記錄
    if (times.length > 100) {
      times.shift();
    }
    
    // 更新平均響應時間
    this.updateAverageAPIResponseTime();
  }

  /**
   * 記錄套利檢測時間
   */
  recordDetectionTime(detectionTime) {
    this.updateAverageDetectionTime(detectionTime);
  }

  /**
   * 記錄錯誤
   */
  recordError(errorType, errorMessage) {
    if (!this.metrics.errorRates.has(errorType)) {
      this.metrics.errorRates.set(errorType, 0);
    }
    
    const currentCount = this.metrics.errorRates.get(errorType);
    this.metrics.errorRates.set(errorType, currentCount + 1);
    
    logger.warn(`錯誤記錄: ${errorType} - ${errorMessage}`);
  }

  /**
   * 更新系統指標
   */
  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    });
    
    // 只保留最近 100 次記錄
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift();
    }
    
    this.metrics.lastUpdate = Date.now();
  }

  /**
   * 更新平均執行時間
   */
  updateAverageExecutionTime(executionTime) {
    if (this.metrics.averageExecutionTime === 0) {
      this.metrics.averageExecutionTime = executionTime;
    } else {
      this.metrics.averageExecutionTime = 
        (this.metrics.averageExecutionTime + executionTime) / 2;
    }
  }

  /**
   * 更新平均檢測時間
   */
  updateAverageDetectionTime(detectionTime) {
    if (this.metrics.averageDetectionTime === 0) {
      this.metrics.averageDetectionTime = detectionTime;
    } else {
      this.metrics.averageDetectionTime = 
        (this.metrics.averageDetectionTime + detectionTime) / 2;
    }
  }

  /**
   * 更新平均 API 響應時間
   */
  updateAverageAPIResponseTime() {
    let totalTime = 0;
    let totalCount = 0;
    
    for (const times of this.metrics.apiResponseTimes.values()) {
      totalTime += times.reduce((a, b) => a + b, 0);
      totalCount += times.length;
    }
    
    if (totalCount > 0) {
      this.metrics.averageAPIResponseTime = totalTime / totalCount;
    }
  }

  /**
   * 更新平均利潤
   */
  updateAverageProfit() {
    if (this.metrics.successfulArbitrages > 0) {
      this.metrics.averageProfit = this.metrics.totalProfit / this.metrics.successfulArbitrages;
    }
  }

  /**
   * 獲取成功率
   */
  getSuccessRate() {
    if (this.metrics.totalArbitrages === 0) {
      return 0;
    }
    return this.metrics.successfulArbitrages / this.metrics.totalArbitrages;
  }

  /**
   * 獲取錯誤率
   */
  getErrorRate() {
    if (this.metrics.totalArbitrages === 0) {
      return 0;
    }
    return this.metrics.failedArbitrages / this.metrics.totalArbitrages;
  }

  /**
   * 獲取 API 平均響應時間
   */
  getAPIAverageResponseTime(exchange, endpoint) {
    const key = `${exchange}-${endpoint}`;
    const times = this.metrics.apiResponseTimes.get(key);
    
    if (!times || times.length === 0) {
      return 0;
    }
    
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  /**
   * 獲取所有 API 響應時間統計
   */
  getAllAPIResponseTimes() {
    const stats = {};
    
    for (const [key, times] of this.metrics.apiResponseTimes) {
      if (times.length > 0) {
        stats[key] = {
          average: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    }
    
    return stats;
  }

  /**
   * 獲取內存使用統計
   */
  getMemoryStats() {
    if (this.metrics.memoryUsage.length === 0) {
      return null;
    }
    
    const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    const heapUsedMB = latest.heapUsed / 1024 / 1024;
    const heapTotalMB = latest.heapTotal / 1024 / 1024;
    
    return {
      current: {
        heapUsed: heapUsedMB.toFixed(2) + ' MB',
        heapTotal: heapTotalMB.toFixed(2) + ' MB',
        usage: ((heapUsedMB / heapTotalMB) * 100).toFixed(2) + '%'
      },
      trend: this.calculateMemoryTrend()
    };
  }

  /**
   * 計算內存使用趨勢
   */
  calculateMemoryTrend() {
    if (this.metrics.memoryUsage.length < 2) {
      return 'stable';
    }
    
    const recent = this.metrics.memoryUsage.slice(-10);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;
    
    const change = (last - first) / first;
    
    if (change > 0.1) {
      return 'increasing';
    } else if (change < -0.1) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * 獲取性能報告
   */
  getPerformanceReport() {
    const uptime = Date.now() - this.metrics.startTime;
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);
    
    return {
      // 基本統計
      uptime: uptimeHours + ' hours',
      totalArbitrages: this.metrics.totalArbitrages,
      successfulArbitrages: this.metrics.successfulArbitrages,
      failedArbitrages: this.metrics.failedArbitrages,
      
      // 成功率
      successRate: (this.getSuccessRate() * 100).toFixed(2) + '%',
      errorRate: (this.getErrorRate() * 100).toFixed(2) + '%',
      
      // 性能指標
      averageExecutionTime: this.metrics.averageExecutionTime.toFixed(2) + 'ms',
      averageDetectionTime: this.metrics.averageDetectionTime.toFixed(4) + 'ms',
      averageAPIResponseTime: this.metrics.averageAPIResponseTime.toFixed(2) + 'ms',
      
      // 利潤統計
      totalProfit: this.metrics.totalProfit.toFixed(2) + ' USDT',
      todayProfit: this.metrics.todayProfit.toFixed(2) + ' USDT',
      averageProfit: this.metrics.averageProfit.toFixed(2) + ' USDT',
      
      // 系統資源
      memoryStats: this.getMemoryStats(),
      
      // API 響應時間統計
      apiResponseStats: this.getAllAPIResponseTimes(),
      
      // 錯誤統計
      errorStats: Object.fromEntries(this.metrics.errorRates),
      
      // 最後更新時間
      lastUpdate: new Date(this.metrics.lastUpdate).toISOString()
    };
  }

  /**
   * 重置統計數據
   */
  resetStats() {
    this.metrics = {
      totalArbitrages: 0,
      successfulArbitrages: 0,
      failedArbitrages: 0,
      averageExecutionTime: 0,
      averageDetectionTime: 0,
      averageAPIResponseTime: 0,
      apiResponseTimes: new Map(),
      errorRates: new Map(),
      totalProfit: 0,
      todayProfit: 0,
      averageProfit: 0,
      memoryUsage: [],
      cpuUsage: [],
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
    
    logger.info('性能統計數據已重置');
  }

  /**
   * 導出統計數據
   */
  exportStats() {
    return {
      metrics: this.metrics,
      report: this.getPerformanceReport(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ArbitragePerformanceMonitor;

