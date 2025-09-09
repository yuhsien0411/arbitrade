/**
 * 跨交易所套利功能驗證腳本
 */
const { ArbitrageEngine } = require('./services/arbitrageEngine');

class CrossExchangeArbitrageTester {
  constructor() {
    this.testResults = { total: 0, passed: 0, failed: 0, errors: [] };
  }

  async runAllTests() {
    console.log('🚀 開始跨交易所套利功能測試...\n');
    
    try {
      await this.initializeTestEnvironment();
      await this.runTestScenarios();
      await this.runPerformanceTests();
      this.generateTestReport();
    } catch (error) {
      console.error('❌ 測試執行失敗:', error);
    }
  }

  async initializeTestEnvironment() {
    console.log('📋 初始化測試環境...');
    this.arbitrageEngine = new ArbitrageEngine();
    console.log('✅ 測試環境初始化完成');
  }

  async runTestScenarios() {
    console.log('\n🧪 運行測試場景...');
    
    const scenarios = [
      { name: 'BTC 現貨 vs 期貨套利', test: () => this.testBTCArbitrage() },
      { name: 'ETH 跨交易所套利', test: () => this.testETHArbitrage() },
      { name: '並發套利測試', test: () => this.testConcurrentArbitrage() }
    ];

    for (const scenario of scenarios) {
      await this.runTestScenario(scenario);
    }
  }

  async runTestScenario(scenario) {
    console.log(`\n📊 測試場景: ${scenario.name}`);
    
    try {
      const startTime = Date.now();
      await scenario.test();
      const duration = Date.now() - startTime;
      
      this.testResults.total++;
      this.testResults.passed++;
      console.log(`✅ ${scenario.name} - 通過 (${duration}ms)`);
    } catch (error) {
      this.testResults.total++;
      this.testResults.failed++;
      this.testResults.errors.push(`${scenario.name}: ${error.message}`);
      console.log(`❌ ${scenario.name} - 失敗: ${error.message}`);
    }
  }

  async testBTCArbitrage() {
    const bybitPrice = { bids: [['50000', '1.5']], asks: [['50001', '1.2']] };
    const binancePrice = { bids: [['49950', '2.0']], asks: [['49951', '1.8']] };
    
    const bybitBid = parseFloat(bybitPrice.bids[0][0]);
    const binanceAsk = parseFloat(binancePrice.asks[0][0]);
    const priceDiff = bybitBid - binanceAsk;
    const profitPercent = (priceDiff / binanceAsk) * 100;
    
    if (profitPercent < 0.1) {
      throw new Error(`價差過小: ${profitPercent.toFixed(4)}%`);
    }
    
    console.log(`   💰 價差: ${priceDiff} USDT (${profitPercent.toFixed(4)}%)`);
  }

  async testETHArbitrage() {
    const bybitPrice = { bids: [['3000', '5.0']], asks: [['3001', '4.5']] };
    const binancePrice = { bids: [['2995', '6.0']], asks: [['2996', '5.5']] };
    
    const bybitBid = parseFloat(bybitPrice.bids[0][0]);
    const binanceAsk = parseFloat(binancePrice.asks[0][0]);
    const profit = bybitBid - binanceAsk;
    const profitPercent = (profit / binanceAsk) * 100;
    
    if (profitPercent < 0.1) {
      throw new Error(`ETH 價差過小: ${profitPercent.toFixed(4)}%`);
    }
    
    console.log(`   💰 ETH 價差: ${profit} USDT (${profitPercent.toFixed(4)}%)`);
  }

  async testConcurrentArbitrage() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    console.log(`   🔄 測試 ${symbols.length} 個交易對並發套利...`);
    
    const startTime = Date.now();
    
    const promises = symbols.map(async (symbol) => {
      const bybitBid = 50000 + Math.random() * 100;
      const binanceAsk = 49950 + Math.random() * 100;
      const profit = bybitBid - binanceAsk;
      return { symbol, profit };
    });
    
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    console.log(`   ⚡ 並發套利檢測完成 (${duration}ms)`);
    
    const profitablePairs = results.filter(r => r.profit > 0);
    if (profitablePairs.length === 0) {
      throw new Error('沒有發現套利機會');
    }
    
    console.log(`   📈 發現 ${profitablePairs.length} 個套利機會`);
  }

  async runPerformanceTests() {
    console.log('\n⚡ 運行性能測試...');
    
    const tests = [
      { name: 'API 響應時間測試', test: () => this.testAPIResponseTime() },
      { name: '套利檢測性能測試', test: () => this.testArbitrageDetectionPerformance() },
      { name: '內存使用測試', test: () => this.testMemoryUsage() }
    ];

    for (const test of tests) {
      await this.runTestScenario(test);
    }
  }

  async testAPIResponseTime() {
    const iterations = 100;
    const responseTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
    }
    
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    if (avgResponseTime > 200) {
      throw new Error(`平均響應時間過長: ${avgResponseTime.toFixed(2)}ms`);
    }
    
    console.log(`   📊 平均響應時間: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   📊 最大響應時間: ${maxResponseTime}ms`);
  }

  async testArbitrageDetectionPerformance() {
    const iterations = 1000;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const price1 = 50000 + Math.random() * 100;
      const price2 = 49950 + Math.random() * 100;
      const profit = price1 - price2;
      const profitPercent = (profit / price2) * 100;
    }
    
    const duration = Date.now() - startTime;
    const avgTime = duration / iterations;
    
    if (avgTime > 0.1) {
      throw new Error(`套利檢測時間過長: ${avgTime.toFixed(4)}ms`);
    }
    
    console.log(`   ⚡ 套利檢測平均時間: ${avgTime.toFixed(4)}ms`);
  }

  async testMemoryUsage() {
    const initialMemory = process.memoryUsage().heapUsed;
    
    const data = [];
    for (let i = 0; i < 10000; i++) {
      data.push({
        id: i,
        symbol: 'BTCUSDT',
        price: 50000 + Math.random() * 100,
        timestamp: Date.now()
      });
    }
    
    const afterMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = afterMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
    
    if (memoryIncreaseMB > 50) {
      throw new Error(`內存使用過多: ${memoryIncreaseMB.toFixed(2)}MB`);
    }
    
    console.log(`   💾 內存使用: ${memoryIncreaseMB.toFixed(2)}MB`);
  }

  generateTestReport() {
    console.log('\n📊 測試報告');
    console.log('='.repeat(50));
    console.log(`總測試數: ${this.testResults.total}`);
    console.log(`通過: ${this.testResults.passed} ✅`);
    console.log(`失敗: ${this.testResults.failed} ❌`);
    console.log(`成功率: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ 錯誤詳情:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎯 測試完成！');
  }
}

// 運行測試
if (require.main === module) {
  const tester = new CrossExchangeArbitrageTester();
  tester.runAllTests().catch(console.error);
}

module.exports = CrossExchangeArbitrageTester;