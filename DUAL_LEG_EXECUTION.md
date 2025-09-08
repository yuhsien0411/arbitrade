# 雙腿下單後端實現說明

## 📋 概述

雙腿下單（Dual-Leg Execution）是套利交易的核心功能，通過同時在不同市場執行相反方向的訂單來捕獲價差利潤。

## 🔧 實現架構

### API 端點
```
POST /api/arbitrage/execute/:pairId
```

### 執行流程

#### 1. ✅ 配置驗證
- 根據 `pairId` 查找監控交易對配置
- 檢查配置是否存在且已啟用
- 驗證交易所支援（目前僅支援 Bybit）

#### 2. ✅ API 連接檢查
- 驗證 Bybit API 密鑰配置
- 確保有足夠的權限執行交易

#### 3. ✅ 價格獲取
```javascript
// 並行獲取兩個交易對的訂單簿
const [leg1OrderBook, leg2OrderBook] = await Promise.all([
    bybitService.getOrderBook(leg1Symbol, pairConfig.leg1.type),
    bybitService.getOrderBook(leg2Symbol, pairConfig.leg2.type)
]);
```

#### 4. ✅ 套利機會計算
```javascript
// 提取最佳買賣價
const leg1Bid = parseFloat(leg1OrderBook.data.b[0][0]); // Leg1 買價
const leg1Ask = parseFloat(leg1OrderBook.data.a[0][0]); // Leg1 賣價
const leg2Bid = parseFloat(leg2OrderBook.data.b[0][0]); // Leg2 買價
const leg2Ask = parseFloat(leg2OrderBook.data.a[0][0]); // Leg2 賣價

// 計算套利價差 (Leg1 賣出，Leg2 買入)
const spread = ((leg1Bid - leg2Ask) / leg2Ask) * 100;
```

#### 5. ✅ 風險控制
- **價差閾值檢查**：確保當前價差大於設定閾值
- **交易金額限制**：檢查是否超過最大持倉限制
- **市場條件驗證**：確保有足夠的流動性

#### 6. ✅ 雙腿下單執行
```javascript
// 準備訂單參數
const leg1OrderParams = {
    symbol: leg1Symbol,
    side: 'Sell', // Leg1 賣出
    orderType: 'Market',
    qty: tradeAmount,
    category: pairConfig.leg1.type
};

const leg2OrderParams = {
    symbol: leg2Symbol,
    side: 'Buy', // Leg2 買入
    orderType: 'Market',
    qty: tradeAmount,
    category: pairConfig.leg2.type
};

// 同時執行以減少延遲
const [leg1Result, leg2Result] = await Promise.all([
    bybitService.placeOrder(leg1OrderParams),
    bybitService.placeOrder(leg2OrderParams)
]);
```

#### 7. ✅ 結果處理
- 檢查兩個訂單是否都成功執行
- 計算實際價差和預期利潤
- 返回詳細的執行結果

## 🚀 關鍵特性

### 並行執行
- 使用 `Promise.all()` 同時獲取價格和執行訂單
- 最小化執行延遲，提高套利成功率

### 原子性操作
- 兩個訂單必須都成功才算執行成功
- 如果部分失敗，提供詳細的錯誤信息

### 實時價格驗證
- 在執行前獲取最新的訂單簿數據
- 確保價差仍然滿足套利條件

### 風險管理
- 多層風險檢查機制
- 交易金額限制
- 價差閾值驗證

## 📊 返回數據格式

### 成功執行
```json
{
  "success": true,
  "data": {
    "pairId": "pair_123",
    "executionTime": "2024-01-15T10:30:00.000Z",
    "leg1": {
      "exchange": "bybit",
      "symbol": "BTCUSDT",
      "side": "sell",
      "quantity": 0.001,
      "price": 45000,
      "orderId": "order_123",
      "orderLinkId": "link_123"
    },
    "leg2": {
      "exchange": "bybit",
      "symbol": "ETHUSDT",
      "side": "buy",
      "quantity": 0.001,
      "price": 2800,
      "orderId": "order_124",
      "orderLinkId": "link_124"
    },
    "spread": 0.22,
    "estimatedProfit": 0.1,
    "threshold": 0.1,
    "timestamp": 1705315800000
  }
}
```

### 執行失敗
```json
{
  "success": false,
  "error": "當前價差 0.05% 小於設定閾值 0.1%",
  "data": {
    "currentSpread": 0.05,
    "threshold": 0.1,
    "leg1Prices": { "bid": 45000, "ask": 45010 },
    "leg2Prices": { "bid": 2800, "ask": 2805 }
  }
}
```

## ⚠️ 風險控制機制

### 1. 配置驗證
- 監控配置必須存在且已啟用
- 交易所必須支援且已連接

### 2. 價格驗證
- 實時獲取最新價格
- 價差必須滿足設定閾值

### 3. 交易限制
- 單筆交易金額限制
- 每日虧損限制（計劃中）

### 4. 執行驗證
- 兩個訂單必須都成功
- 提供詳細的失敗原因

## 🔮 未來擴展

### 多交易所支援
- Binance 集成
- OKX 集成
- Bitget 集成

### 高級訂單類型
- 限價訂單支援
- 條件訂單
- 部分成交處理

### 風險管理增強
- 動態風險限制
- 實時 PnL 追蹤
- 自動止損機制

### 性能優化
- WebSocket 價格推送
- 訂單簿深度分析
- 延遲優化

## 📝 使用範例

### 基本套利執行
```bash
curl -X POST http://localhost:5000/api/arbitrage/execute/pair_123
```

### 監控配置範例
```json
{
  "id": "pair_123",
  "enabled": true,
  "leg1": {
    "exchange": "bybit",
    "symbol": "BTCUSDT",
    "type": "linear"
  },
  "leg2": {
    "exchange": "bybit", 
    "symbol": "ETHUSDT",
    "type": "linear"
  },
  "threshold": 0.1,
  "amount": 0.001
}
```

## 🛡️ 安全考量

### API 密鑰管理
- 環境變數存儲
- 權限最小化原則
- 定期輪換建議

### 交易安全
- 實名制交易
- IP 白名單限制
- 資金密碼保護

### 系統安全
- 錯誤日誌記錄
- 異常監控
- 自動熔斷機制

---

*此文檔描述了雙腿下單的完整實現流程，確保安全、高效的套利交易執行。*

