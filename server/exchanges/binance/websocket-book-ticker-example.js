/**
 * Binance WebSocket 最優掛單數據流使用範例
 * 
 * 這個範例展示如何使用 Binance WebSocket 訂閱最優掛單數據流
 * 實時獲取指定交易對的最優買單和賣單信息
 */

const BinanceExchange = require('./BinanceExchange');

async function websocketBookTickerExample() {
    console.log('📡 Binance WebSocket 最優掛單數據流範例\n');

    try {
        // 創建 Binance 交易所實例（需要API KEY才能使用WebSocket）
        const binance = new BinanceExchange({
            apiKey: process.env.BINANCE_API_KEY || 'your_api_key_here',
            secret: process.env.BINANCE_SECRET_KEY || 'your_secret_key_here',
            testnet: false
        });

        // 初始化交易所
        await binance.initialize();
        console.log('✅ Binance 交易所初始化成功');

        // 設置事件監聽器
        setupEventListeners(binance);

        // 訂閱 BTCUSDT 的最優掛單數據
        console.log('\n🔔 訂閱 BTCUSDT 最優掛單數據流...');
        binance.subscribeBookTicker('BTCUSDT');

        // 訂閱 ETHUSDT 的最優掛單數據
        console.log('🔔 訂閱 ETHUSDT 最優掛單數據流...');
        binance.subscribeBookTicker('ETHUSDT');

        // 訂閱 ADAUSDT 的最優掛單數據
        console.log('🔔 訂閱 ADAUSDT 最優掛單數據流...');
        binance.subscribeBookTicker('ADAUSDT');

        console.log('\n📊 開始接收實時最優掛單數據...');
        console.log('按 Ctrl+C 停止監聽\n');

        // 保持程序運行
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 正在停止監聽...');
            await binance.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ 範例運行失敗:', error.message);
        
        if (error.message.includes('WebSocket 客戶端未初始化')) {
            console.log('\n💡 提示: 需要配置有效的 Binance API KEY 才能使用 WebSocket 功能');
            console.log('   請在 .env 文件中設置:');
            console.log('   BINANCE_API_KEY=your_actual_api_key');
            console.log('   BINANCE_SECRET_KEY=your_actual_secret_key');
        }
    }
}

/**
 * 設置事件監聽器
 */
function setupEventListeners(binance) {
    // 監聽最優掛單數據
    binance.on('bookTicker', (data) => {
        console.log(`📈 [${data.symbol}] 最優掛單更新:`);
        console.log(`   買單: ${data.bidPrice} (數量: ${data.bidQty})`);
        console.log(`   賣單: ${data.askPrice} (數量: ${data.askQty})`);
        console.log(`   更新ID: ${data.updateId}`);
        console.log(`   時間: ${new Date(data.eventTime).toISOString()}`);
        console.log(`   價差: ${(data.askPrice - data.bidPrice).toFixed(4)} USDT`);
        console.log(`   價差百分比: ${(((data.askPrice - data.bidPrice) / data.bidPrice) * 100).toFixed(4)}%`);
        console.log('   ' + '-'.repeat(50));
    });

    // 監聽錯誤
    binance.on('error', (error) => {
        console.error('❌ WebSocket 錯誤:', error.message);
    });

    // 監聽連接狀態
    binance.on('connect', () => {
        console.log('✅ WebSocket 連接已建立');
    });

    binance.on('disconnect', () => {
        console.log('❌ WebSocket 連接已斷開');
    });
}

/**
 * 高級使用範例：套利機會監控
 */
async function arbitrageMonitoringExample() {
    console.log('🔍 套利機會監控範例\n');

    try {
        const binance = new BinanceExchange({
            apiKey: process.env.BINANCE_API_KEY || 'your_api_key_here',
            secret: process.env.BINANCE_SECRET_KEY || 'your_secret_key_here',
            testnet: false
        });

        await binance.initialize();

        // 監控多個交易對的價差
        const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT'];
        const priceData = new Map();

        // 訂閱所有交易對
        symbols.forEach(symbol => {
            binance.subscribeBookTicker(symbol);
        });

        // 設置監控邏輯
        binance.on('bookTicker', (data) => {
            priceData.set(data.symbol, data);
            
            // 計算價差
            const spread = data.askPrice - data.bidPrice;
            const spreadPercent = (spread / data.bidPrice) * 100;
            
            // 如果價差超過0.1%，顯示警告
            if (spreadPercent > 0.1) {
                console.log(`⚠️  [${data.symbol}] 價差異常: ${spreadPercent.toFixed(4)}%`);
                console.log(`   買單: ${data.bidPrice} | 賣單: ${data.askPrice}`);
            }
        });

        console.log('開始監控套利機會...');
        console.log('按 Ctrl+C 停止監聽\n');

        process.on('SIGINT', async () => {
            console.log('\n🛑 停止監控...');
            await binance.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ 監控範例失敗:', error.message);
    }
}

// 運行範例
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--arbitrage')) {
        arbitrageMonitoringExample().catch(console.error);
    } else {
        websocketBookTickerExample().catch(console.error);
    }
}

module.exports = {
    websocketBookTickerExample,
    arbitrageMonitoringExample
};
