/**
 * Bybit WebSocket 訂閱範例
 * 使用 bybit-api SDK 訂閱 tickers 和 orderbook
 */

const { WebsocketClient } = require('bybit-api');

// 建立 WebSocket 客戶端
const wsClient = new WebsocketClient({
  key: process.env.BYBIT_API_KEY || '', // 可選，公共頻道不需要
  secret: process.env.BYBIT_SECRET || '', // 可選，公共頻道不需要
  market: 'v5',
  testnet: false, // 使用真實平台
});

// 設定事件監聽器
wsClient.on('open', (data) => {
  console.log('✅ WebSocket 連線已建立:', data);
});

wsClient.on('error', (error) => {
  console.error('❌ WebSocket 錯誤:', error);
});

wsClient.on('close', () => {
  console.log('🔌 WebSocket 連線已關閉');
});

wsClient.on('update', (data) => {
  handleWebSocketUpdate(data);
});

// 處理 WebSocket 更新
function handleWebSocketUpdate(data) {
  try {
    if (data.topic && data.topic.startsWith('tickers.')) {
      handleTickerUpdate(data);
    } else if (data.topic && data.topic.startsWith('orderbook.')) {
      handleOrderBookUpdate(data);
    } else {
      console.log('📨 其他更新:', data);
    }
  } catch (error) {
    console.error('處理更新失敗:', error);
  }
}

// 處理 tickers 更新
function handleTickerUpdate(message) {
  const { ts, data } = message;
  if (!data || !data.symbol) return;

  const bidPrice = Number(data.bidPrice || 0);
  const askPrice = Number(data.askPrice || 0);
  const bidSize = Number(data.bidSize || 0);
  const askSize = Number(data.askSize || 0);

  console.log(`📊 [TICKERS] ${data.symbol}:`, {
    bid: bidPrice,
    ask: askPrice,
    bidSize: bidSize,
    askSize: askSize,
    lastPrice: data.lastPrice,
    ts: new Date(ts).toISOString()
  });
}

// 處理 orderbook 更新
function handleOrderBookUpdate(data) {
  const { ts, data: orderbookData } = data;
  if (!orderbookData || !orderbookData.s) return;

  const symbol = orderbookData.s;
  const bids = orderbookData.b || [];
  const asks = orderbookData.a || [];

  const bestBid = bids.length > 0 ? bids[0] : null;
  const bestAsk = asks.length > 0 ? asks[0] : null;

  console.log(`📈 [ORDERBOOK] ${symbol}:`, {
    bid1: bestBid ? { price: Number(bestBid[0]), size: Number(bestBid[1]) } : null,
    ask1: bestAsk ? { price: Number(bestAsk[0]), size: Number(bestAsk[1]) } : null,
    ts: new Date(ts).toISOString()
  });
}

// 訂閱函數
function subscribeToSymbol(symbol, category = 'linear') {
  console.log(`🔔 開始訂閱 ${symbol} @ ${category}`);
  
  // 訂閱 tickers（100ms 更新）
  wsClient.subscribeV5(`tickers.${symbol}`, category);
  
  // 訂閱 orderbook depth=1（10ms 更新）
  wsClient.subscribeV5(`orderbook.1.${symbol}`, category);
}

// 取消訂閱函數
function unsubscribeFromSymbol(symbol, category = 'linear') {
  console.log(`🔕 取消訂閱 ${symbol} @ ${category}`);
  
  wsClient.unsubscribeV5(`tickers.${symbol}`, category);
  wsClient.unsubscribeV5(`orderbook.1.${symbol}`, category);
}

// 主程式
async function main() {
  console.log('🚀 啟動 Bybit WebSocket 訂閱範例');
  
  // 等待連線建立
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 訂閱範例交易對
  subscribeToSymbol('BTCUSDT', 'linear');  // 永續合約
  subscribeToSymbol('BTCUSDT', 'spot');    // 現貨
  
  // 5 秒後取消訂閱
  setTimeout(() => {
    unsubscribeFromSymbol('BTCUSDT', 'linear');
    unsubscribeFromSymbol('BTCUSDT', 'spot');
  }, 5000);
  
  // 10 秒後關閉連線
  setTimeout(() => {
    console.log('🛑 關閉 WebSocket 連線');
    wsClient.closeAll();
    process.exit(0);
  }, 10000);
}

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n🛑 接收到中斷信號，關閉連線...');
  wsClient.closeAll();
  process.exit(0);
});

// 啟動
main().catch(console.error);
