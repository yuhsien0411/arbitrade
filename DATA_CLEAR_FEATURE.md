# 資料清空功能說明文檔

## 功能概述

為了確保系統在每次重新啟動時都能從乾淨的狀態開始，我們實現了完整的資料清空功能。此功能會在系統啟動時自動執行，清空前後端的所有資料，包括：

- 後端記憶體中的套利引擎資料
- 後端記憶體中的 TWAP 引擎資料
- 後端記憶體中的監控對資料
- 前端 Redux 狀態
- 前端 localStorage 存儲

## 實現方式

### 後端實現

1. **套利引擎清空**：
   - 在 `arbitrage_engine.py` 中實現了 `clear_all_data()` 方法
   - 清空所有監控對、執行計數和執行歷史

2. **TWAP 引擎清空**：
   - 在 `twap_engine.py` 中實現了 `clear_all_data()` 方法
   - 清空所有 TWAP 計畫、進度和執行記錄

3. **監控對清空**：
   - 在 `routes_monitoring.py` 中實現了 `clear_monitoring_data()` 方法
   - 清空所有監控對資料

4. **統一 API 端點**：
   - 在 `routes_arbitrage.py` 中添加了 `/api/arbitrage/clear-all-data` 端點
   - 此端點會清空所有後端資料

5. **啟動時自動清空**：
   - 在 `main.py` 的 `lifespan` 函數中添加了啟動時清空資料的邏輯

### 前端實現

1. **Redux 狀態清空**：
   - 在各 slice 中添加了清空資料的 reducer
   - `arbitrageSlice.ts` 中的 `clearAllArbitrageData`
   - `twapSlice.ts` 中的 `clearAllTwapData`
   - `pricesSlice.ts` 中的 `clearAllPricesData`
   - `systemSlice.ts` 中的 `clearAllSystemData`

2. **localStorage 清空**：
   - 在 `storage.ts` 中添加了 `clearAll()` 方法
   - 此方法會清空所有 localStorage 資料

3. **統一清空服務**：
   - 創建了 `clearDataService.ts` 服務
   - 提供了清空前端資料、後端資料和所有資料的方法

4. **啟動時自動清空**：
   - 在 `App.tsx` 中使用 `useLayoutEffect` 在組件載入前清空 localStorage
   - 在 `App.tsx` 的 `useEffect` 中清空後端資料和 Redux 狀態

## 啟動腳本更新

1. **start.bat**：
   - 添加了清空舊資料的步驟
   - 更新了步驟計數和描述

2. **start.ps1**：
   - 創建了新的 PowerShell 啟動腳本
   - 包含清空資料的步驟

## 測試

創建了 `test_clear_data.py` 測試腳本，用於驗證資料清空功能：

1. 測試後端清空 API
2. 檢查套利引擎狀態
3. 檢查套利交易對
4. 檢查 TWAP 策略

## 使用方法

系統會在啟動時自動清空所有資料，無需手動操作。如果需要在運行過程中清空資料，可以：

1. 重新啟動系統
2. 使用 API 端點手動清空：
   ```
   POST /api/arbitrage/clear-all-data
   ```

## 注意事項

- 資料清空是不可逆的操作，請確保在清空前已備份重要資料
- 清空操作會導致所有監控對和 TWAP 策略被刪除
- 清空操作不會影響 API 密鑰設定
