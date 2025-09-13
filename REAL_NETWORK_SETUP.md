# 真實網路設置指南

## 配置 Bybit 真實網路 API

要使用真實網路進行 TWAP 交易，您需要：

### 1. 獲取 Bybit API 金鑰

1. 登入 [Bybit 官網](https://www.bybit.com)
2. 前往「帳戶」→「API 管理」
3. 創建新的 API 金鑰
4. 確保啟用以下權限：
   - 現貨交易 (Spot Trading)
   - 永續合約交易 (Derivatives Trading)
   - 讀取權限 (Read)

### 2. 設置環境變數

創建 `.env` 文件在專案根目錄：

```bash
# 交易所 API 設定
BYBIT_API_KEY=your_real_bybit_api_key_here
BYBIT_SECRET=your_real_bybit_secret_here

# 系統設定 - 設為 false 使用真實網路
DEBUG=false
LOG_LEVEL=INFO
```

### 3. 安全注意事項

⚠️ **重要安全提醒**：
- 永遠不要將真實的 API 金鑰提交到版本控制系統
- 確保 `.env` 文件在 `.gitignore` 中
- 定期輪換 API 金鑰
- 只啟用必要的權限

### 4. 測試配置

重新啟動 Python 後端後，檢查日誌中是否顯示：
- `testnet: false` (表示使用真實網路)
- `has_api_key: true` (表示已配置 API 金鑰)
- `has_secret: true` (表示已配置 API 密鑰)

### 5. 驗證交易

創建一個小額的 TWAP 策略來測試：
- 使用較小的交易數量（如 0.001 ETH）
- 設置較短的間隔時間（如 10 秒）
- 監控日誌確認訂單執行成功

## 故障排除

### 常見錯誤

1. **ErrCode: 10003** - 未授權
   - 檢查 API 金鑰是否正確
   - 確認 API 權限是否包含交易權限

2. **ErrCode: 10001** - 簽名錯誤
   - 檢查 API 密鑰是否正確
   - 確認時間同步

3. **ErrCode: 10004** - 餘額不足
   - 檢查帳戶餘額
   - 確認交易對是否正確

### 日誌檢查

查看 Python 後端日誌中的以下信息：
- `twap_engine_initialized` - 引擎初始化狀態
- `twap_plan_started` - 策略啟動狀態
- `twap_execution_success` - 訂單執行成功
- `twap_execution_failed` - 訂單執行失敗
