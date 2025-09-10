/**
 * Binance 最優掛單 API 使用範例
 * 
 * 這個範例展示如何使用 Binance 的最優掛單 API
 * 獲取最高買單和最低賣單的價格和數量
 */

const BinancePublicClient = require('./BinancePublicClient');
const BinanceExchange = require('./BinanceExchange');

async function exampleUsage() {
    console.log('📊 Binance 最優掛單 API 使用範例\n');

    // 方法1: 使用 BinancePublicClient (無需API KEY)
    console.log('方法1: 使用 BinancePublicClient (公開數據)');
    console.log('='.repeat(50));
    
    const publicClient = new BinancePublicClient();
    
    try {
        // 獲取單個交易對的最優掛單
        const btcTicker = await publicClient.getTicker('BTCUSDT');
        if (btcTicker.success) {
            console.log('BTCUSDT 最優掛單:');
            console.log(`  買單價格: ${btcTicker.data.bidPrice} (數量: ${btcTicker.data.bidQty})`);
            console.log(`  賣單價格: ${btcTicker.data.askPrice} (數量: ${btcTicker.data.askQty})`);
            console.log(`  更新時間: ${new Date(btcTicker.data.time).toISOString()}`);
        }

        // 獲取多個交易對的最優掛單
        const allTickers = await publicClient.getAllTickers();
        if (allTickers.success) {
            console.log(`\n總共獲取到 ${allTickers.data.length} 個交易對的最優掛單`);
            
            // 顯示前3個交易對
            console.log('\n前3個交易對:');
            allTickers.data.slice(0, 3).forEach((ticker, index) => {
                console.log(`  ${index + 1}. ${ticker.symbol}: 買單 ${ticker.bidPrice} (${ticker.bidQty}) | 賣單 ${ticker.askPrice} (${ticker.askQty})`);
            });
        }
    } catch (error) {
        console.error('公開客戶端錯誤:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 方法2: 使用 BinanceExchange (需要API KEY，但支持公開數據模式)
    console.log('方法2: 使用 BinanceExchange (支持公開數據模式)');
    console.log('='.repeat(50));
    
    try {
        const exchange = new BinanceExchange({
            apiKey: null, // 公開數據模式
            secret: null,
            testnet: false
        });

        await exchange.initialize();
        console.log('✅ Binance 交易所初始化成功 (公開數據模式)');

        // 獲取單個交易對的最優掛單
        const btcBookTicker = await exchange.getBookTicker('BTCUSDT');
        console.log('\nBTCUSDT 最優掛單 (通過 Exchange):');
        console.log(`  買單價格: ${btcBookTicker.bidPrice} (數量: ${btcBookTicker.bidQty})`);
        console.log(`  賣單價格: ${btcBookTicker.askPrice} (數量: ${btcBookTicker.askQty})`);
        console.log(`  交易所: ${btcBookTicker.exchange}`);
        console.log(`  更新時間: ${new Date(btcBookTicker.time).toISOString()}`);

        // 獲取多個交易對的最優掛單
        const allBookTickers = await exchange.getAllBookTickers();
        console.log(`\n總共獲取到 ${allBookTickers.length} 個交易對的最優掛單`);
        
        // 顯示前3個交易對
        console.log('\n前3個交易對:');
        allBookTickers.slice(0, 3).forEach((ticker, index) => {
            console.log(`  ${index + 1}. ${ticker.symbol}: 買單 ${ticker.bidPrice} (${ticker.bidQty}) | 賣單 ${ticker.askPrice} (${ticker.askQty})`);
        });

    } catch (error) {
        console.error('交易所錯誤:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 方法3: 通過 REST API 端點
    console.log('方法3: 通過 REST API 端點');
    console.log('='.repeat(50));
    console.log('API 端點:');
    console.log('  GET /api/book-ticker/binance/BTCUSDT  - 獲取單個交易對最優掛單');
    console.log('  GET /api/book-ticker/binance          - 獲取所有交易對最優掛單');
    console.log('\n範例請求:');
    console.log('  curl http://localhost:5000/api/book-ticker/binance/BTCUSDT');
    console.log('  curl http://localhost:5000/api/book-ticker/binance');
}

// 運行範例
if (require.main === module) {
    exampleUsage().catch(console.error);
}

module.exports = exampleUsage;
