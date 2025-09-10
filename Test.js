
// 1. 導入 bybit-api
const { RestClientV5 } = require('bybit-api');

// 2. 創建 Bybit 客戶端
const client = new RestClientV5({
  key: 'jLb82vRaXPIprsaq4E',
  secret: 'ecbPTZY5soFKikZ0gRGWN99dLKOKQMdkteC2',
  testnet: false
});

// 3. 測試 API 連接 (需要使用 async/await)
async function testConnection() {
  try {
    const accountInfo = await client.getAccountInfo();
    
    // 4. 處理響應
    if (accountInfo.retCode === 0) {
      // 成功：返回帳戶信息
      console.log('API 連接成功:', accountInfo);
    } else {
      // 失敗：返回錯誤信息和建議
      console.log('API 連接失敗:', accountInfo);
    }
  } catch (error) {
    console.log('API 調用錯誤:', error);
  }
}

// 執行測試
testConnection();