# Python 測試腳本使用說明

這個目錄包含了用於測試雙腿套利系統的 Python 腳本。

## 📁 文件說明

- `Test.py` - 完整的模擬器，包含所有功能測試
- `quick_test.py` - 快速測試腳本，用於基本功能驗證
- `websocket_test.py` - WebSocket 連接測試腳本
- `requirements.txt` - Python 依賴包列表

## 🚀 快速開始

### 1. 安裝依賴

```bash
pip install -r requirements.txt
```

### 2. 確保後端運行

確保後端服務器在 `http://localhost:5000` 運行：

```bash
cd server
npm run dev
```

### 3. 運行測試

#### 快速測試（推薦）
```bash
python quick_test.py
```

#### 完整模擬測試
```bash
python Test.py
```

#### WebSocket 測試
```bash
python websocket_test.py
```

## 📋 測試功能

### quick_test.py
- ✅ 健康檢查
- ✅ 交易所狀態查詢
- ✅ 添加監控交易對
- ✅ 獲取監控交易對列表
- ✅ 賬戶信息查詢

### Test.py (完整模擬器)
- ✅ 所有基本功能測試
- ✅ 多個套利交易對配置
- ✅ 定期檢查套利機會
- ✅ 完整的錯誤處理
- ✅ 詳細的日誌輸出

### websocket_test.py
- ✅ WebSocket 連接測試
- ✅ 實時消息接收
- ✅ 前端日誌模擬
- ✅ 套利監控訂閱
- ✅ 心跳消息測試

## 🔧 自定義配置

### 修改後端地址
```python
# 在腳本中修改 base_url
simulator = ArbitrageSimulator(base_url="http://your-server:5000")
```

### 自定義套利交易對
```python
arbitrage_pairs = [
    {
        "leg1": {
            "exchange": "bybit",
            "symbol": "BTCUSDT",
            "side": "buy",
            "qty": 0.001
        },
        "leg2": {
            "exchange": "binance",
            "symbol": "BTCUSDT", 
            "side": "sell",
            "qty": 0.001
        },
        "threshold": 0.5,
        "qty": 0.001,
        "totalAmount": 100.0
    }
]
```

## 📊 預期輸出

### 成功運行示例
```
🚀 快速測試雙腿套利 API
========================================
1. 測試健康檢查...
   狀態碼: 200
   ✅ 後端正常運行

2. 測試交易所狀態...
   狀態碼: 200
   - Bybit: ✅ 已連接
   - Binance: ✅ 已連接

3. 測試添加監控交易對...
   狀態碼: 200
   ✅ 監控交易對添加成功
   ID: pair_1757451597_0

4. 測試獲取監控交易對...
   狀態碼: 200
   ✅ 獲取成功，共 1 個交易對
   - BTCUSDT (bybit) <-> BTCUSDT (binance)

5. 測試賬戶信息...
   狀態碼: 200
   ✅ 賬戶信息獲取成功
   - 總權益: 0.00 USDT

✅ 測試完成！
```

## 🐛 故障排除

### 連接失敗
- 檢查後端是否運行在正確端口
- 檢查防火牆設置
- 確認 URL 地址正確

### API 錯誤
- 檢查後端日誌
- 確認 API 端點是否正確
- 檢查請求格式

### WebSocket 連接失敗
- 確認 WebSocket 服務已啟動
- 檢查端口是否被占用
- 確認 URL 協議 (ws://)

## 📝 注意事項

1. **測試環境**: 這些腳本僅用於測試，不會執行真實交易
2. **數據安全**: 測試數據不會影響生產環境
3. **資源使用**: 長時間運行可能消耗較多資源
4. **網絡依賴**: 需要穩定的網絡連接

## 🔄 持續測試

可以設置定時任務來定期運行測試：

```bash
# 每 5 分鐘運行一次快速測試
*/5 * * * * cd /path/to/arbi && python quick_test.py
```

## 📞 支持

如果遇到問題，請檢查：
1. 後端服務器日誌
2. 網絡連接狀態
3. Python 依賴是否正確安裝
4. 端口是否被占用
