/**
 * 跨交易所套利示例
 * 演示如何使用 Bybit + Binance 進行跨交易所套利
 */

const { ArbitrageEngine } = require('../services/arbitrageEngine');
const logger = require('../utils/logger');

async function runCrossExchangeArbitrageExample() {
    console.log('🚀 啟動跨交易所套利示例...\n');

    try {
        // 創建套利引擎實例
        const engine = new ArbitrageEngine();

        // 啟動引擎
        await engine.start();
        console.log('✅ 套利引擎啟動成功\n');

        // 檢查交易所連接狀態
        const status = engine.getStatus();
        console.log('📊 交易所連接狀態:');
        console.log(`  Bybit: ${status.exchanges.bybit.connected ? '✅ 已連接' : '❌ 未連接'}`);
        console.log(`  Binance: ${status.exchanges.binance.connected ? '✅ 已連接' : '❌ 未連接'}\n`);

        if (!status.exchanges.bybit.connected || !status.exchanges.binance.connected) {
            console.log('⚠️  請確保兩個交易所都已正確配置和連接');
            return;
        }

        // 示例 1: Bybit 期貨 vs Binance 現貨套利
        console.log('📈 示例 1: Bybit 期貨 vs Binance 現貨套利');
        const pair1 = await engine.addMonitoringPair({
            id: 'bybit_futures_binance_spot',
            leg1: {
                exchange: 'bybit',
                symbol: 'BTCUSDT',
                type: 'linear' // 期貨
            },
            leg2: {
                exchange: 'binance',
                symbol: 'BTCUSDT',
                type: 'spot' // 現貨
            },
            threshold: 0.1, // 0.1% 價差觸發
            amount: 0.001, // 交易數量
            enabled: true
        });
        console.log(`  已添加監控交易對: ${pair1.id}\n`);

        // 示例 2: Binance 現貨 vs Bybit 期貨套利
        console.log('📈 示例 2: Binance 現貨 vs Bybit 期貨套利');
        const pair2 = await engine.addMonitoringPair({
            id: 'binance_spot_bybit_futures',
            leg1: {
                exchange: 'binance',
                symbol: 'ETHUSDT',
                type: 'spot' // 現貨
            },
            leg2: {
                exchange: 'bybit',
                symbol: 'ETHUSDT',
                type: 'linear' // 期貨
            },
            threshold: 0.15, // 0.15% 價差觸發
            amount: 0.01, // 交易數量
            enabled: true
        });
        console.log(`  已添加監控交易對: ${pair2.id}\n`);

        // 示例 3: 同交易對不同交易所套利
        console.log('📈 示例 3: 同交易對不同交易所套利');
        const pair3 = await engine.addMonitoringPair({
            id: 'cross_exchange_btc',
            leg1: {
                exchange: 'bybit',
                symbol: 'BTCUSDT',
                type: 'spot'
            },
            leg2: {
                exchange: 'binance',
                symbol: 'BTCUSDT',
                type: 'spot'
            },
            threshold: 0.05, // 0.05% 價差觸發
            amount: 0.001,
            enabled: true
        });
        console.log(`  已添加監控交易對: ${pair3.id}\n`);

        // 設置事件監聽器
        engine.on('opportunitiesFound', (opportunities) => {
            console.log('🎯 發現套利機會:');
            opportunities.forEach(opp => {
                console.log(`  ${opp.id}: ${opp.spreadPercent.toFixed(3)}% 價差`);
                console.log(`    方向: ${opp.direction}`);
                console.log(`    Leg1 (${opp.leg1Price.exchange}): ${opp.leg1Price.bid1.price}`);
                console.log(`    Leg2 (${opp.leg2Price.exchange}): ${opp.leg2Price.ask1.price}\n`);
            });
        });

        engine.on('arbitrageExecuted', (result) => {
            if (result.success) {
                console.log('✅ 套利執行成功:');
                console.log(`  Leg1: ${result.result.leg1?.orderId || 'N/A'}`);
                console.log(`  Leg2: ${result.result.leg2?.orderId || 'N/A'}\n`);
            } else {
                console.log('❌ 套利執行失敗:', result.error);
            }
        });

        engine.on('priceUpdate', (opportunity) => {
            // 只顯示有價差的情況
            if (Math.abs(opportunity.spreadPercent) > 0.01) {
                console.log(`📊 ${opportunity.id}: ${opportunity.spreadPercent.toFixed(3)}% 價差`);
            }
        });

        // 手動測試套利機會分析
        console.log('🔍 手動測試套利機會分析...\n');
        
        for (const [id, pairConfig] of engine.monitoringPairs) {
            try {
                const opportunity = await engine.analyzePairSpread(pairConfig);
                if (opportunity) {
                    console.log(`✅ ${id}: 發現套利機會`);
                    console.log(`   價差: ${opportunity.spreadPercent.toFixed(3)}%`);
                    console.log(`   方向: ${opportunity.direction}\n`);
                } else {
                    console.log(`ℹ️  ${id}: 暫無套利機會\n`);
                }
            } catch (error) {
                console.log(`❌ ${id}: 分析失敗 - ${error.message}\n`);
            }
        }

        // 顯示當前監控的交易對
        console.log('📋 當前監控的交易對:');
        const pairs = Array.from(engine.monitoringPairs.values());
        pairs.forEach(pair => {
            console.log(`  ${pair.id}:`);
            console.log(`    Leg1: ${pair.leg1.exchange} ${pair.leg1.symbol} (${pair.leg1.type})`);
            console.log(`    Leg2: ${pair.leg2.exchange} ${pair.leg2.symbol} (${pair.leg2.type})`);
            console.log(`    觸發閾值: ${pair.threshold}%`);
            console.log(`    交易數量: ${pair.amount}`);
            console.log(`    狀態: ${pair.enabled ? '啟用' : '禁用'}\n`);
        });

        // 顯示系統統計
        console.log('📊 系統統計:');
        const stats = engine.getStatus();
        console.log(`  總交易對: ${stats.monitoringPairs.length}`);
        console.log(`  總交易次數: ${stats.stats.totalTrades}`);
        console.log(`  成功交易: ${stats.stats.successfulTrades}`);
        console.log(`  總利潤: ${stats.stats.totalProfit.toFixed(4)}`);
        console.log(`  今日利潤: ${stats.stats.todayProfit.toFixed(4)}\n`);

        console.log('🎉 跨交易所套利示例運行完成！');
        console.log('💡 提示: 系統將持續監控價格並自動執行套利交易');
        console.log('⚠️  注意: 請確保在生產環境中設置適當的風險控制參數\n');

        // 保持運行狀態（在實際應用中）
        // setTimeout(async () => {
        //     await engine.stop();
        //     console.log('🛑 套利引擎已停止');
        // }, 30000); // 30秒後停止

    } catch (error) {
        console.error('❌ 跨交易所套利示例運行失敗:', error);
        logger.error('跨交易所套利示例錯誤:', error);
    }
}

// 如果直接運行此文件
if (require.main === module) {
    runCrossExchangeArbitrageExample().catch(console.error);
}

module.exports = {
    runCrossExchangeArbitrageExample
};
