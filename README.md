# 📈 Arbitrade

## 📋 項目介紹

專業的加密貨幣套利交易平台，支援跨交易所的差價套利和TWAP（時間加權平均價格）執行策略。系統能夠即時監控多個交易所的bid1/ask1價格，並在發現套利機會時自動執行雙腿訂單。

### 🎯 主要功能
- **雙腿套利交易**：跨交易所現貨/合約套利
- **TWAP執行策略**：時間加權平均價格執行
- **即時價差監控**：精確監控bid1/ask1價格差異
- **智能風險控制**：完善的風險管理機制
- **專業交易界面**：現代化設計，操作簡潔

### 🔧 技術架構
- **前端**：React 18 + TypeScript + Ant Design
- **後端**：Python FastAPI + WebSocket
- **交易所**：Bybit API 集成
- **部署**：Docker 容器化

## 🚀 快速部署

### 系統要求
- Docker Desktop (Windows/macOS) 或 Docker Engine (Linux)
- 至少 4GB 可用內存
- 至少 2GB 可用磁盤空間

### 1. 下載項目
```bash
git clone <repository-url>
cd arbitrade
```

### 2. 配置環境
```bash
# 複製環境配置文件
cp env.example .env

# 編輯 .env 文件，填入您的 Bybit API 密鑰
# BYBIT_API_KEY=your_bybit_api_key_here
# BYBIT_API_SECRET=your_bybit_api_secret_here
```

### 3. 啟動服務
```bash
# 構建並啟動所有服務
docker-compose up -d --build
```
後端
py -m uvicorn app.main:app --host 0.0.0.0 --port 7000

### 4. 訪問系統
- **前端界面**：http://localhost:3000
- **後端API**：http://localhost:7000

## 🛠️ 管理命令

### 基本操作
```bash
# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down

# 重啟服務
docker-compose restart

# 重新構建
docker-compose up -d --build
```

### 查看特定服務
```bash
# 查看後端日誌
docker-compose logs -f arbitrade-backend

# 查看前端日誌
docker-compose logs -f arbitrade-frontend
```

## 📊 開始使用

### 1. 配置 API 密鑰
1. 登錄 Bybit 官網
2. 進入 API 管理頁面
3. 創建新的 API 密鑰
4. 確保密鑰具有交易權限
5. 將密鑰填入 `.env` 文件

### 2. 套利交易
1. 進入「雙腿套利」頁面
2. 添加要監控的交易對
3. 設定觸發閾值和交易數量
4. 啟用監控，等待套利機會

### 3. TWAP 策略
1. 進入「TWAP策略」頁面
2. 配置交易對和數量
3. 設定時間間隔和執行策略
4. 啟動 TWAP 執行

## 🔍 系統檢查

在啟動前，建議先運行系統檢查腳本：

```bash
# 檢查系統配置和依賴
python check_system.py
```

## ❓ 常見問題

### Q: 啟動失敗怎麼辦？
A: 請按順序檢查：
1. **環境文件**：確保 `.env` 文件存在且配置正確
   ```bash
   cp env.example .env
   # 編輯 .env 文件填入真實的 API 金鑰
   ```
2. **Docker 服務**：確保 Docker Desktop 正在運行
3. **端口佔用**：檢查端口 3000 和 7000 是否被佔用
   ```bash
   # Windows
   netstat -an | findstr :3000
   netstat -an | findstr :7000
   ```
4. **API 密鑰**：確保 `.env` 文件中的 API 密鑰格式正確

### Q: 如何查看錯誤日誌？
A: 使用以下命令查看詳細日誌：
```bash
# 查看所有服務日誌
docker-compose logs -f

# 查看特定服務日誌
docker-compose logs -f arbitrade-backend
docker-compose logs -f arbitrade-frontend

# 查看最近的錯誤
docker-compose logs --tail=50 arbitrade-backend
```

### Q: 如何檢查系統狀態？
A: 訪問以下端點檢查系統狀態：
- **健康檢查**：http://localhost:7000/health
- **配置狀態**：http://localhost:7000/api/config/status
- **前端界面**：http://localhost:3000

### Q: 如何停止服務？
A: 運行以下命令停止服務：
```bash
# 停止所有服務
docker-compose down

# 停止並刪除所有數據
docker-compose down -v
```

### Q: 如何重新配置？
A: 編輯 `.env` 文件後重啟服務：
```bash
# 重啟所有服務
docker-compose restart

# 重新構建並啟動
docker-compose up -d --build
```

### Q: WebSocket 連接問題？
A: 如果前端無法連接到 WebSocket：
1. 檢查防火牆設置
2. 確認端口 7000 可訪問
3. 查看瀏覽器控制台錯誤信息
4. 檢查後端日誌中的 WebSocket 錯誤

### Q: API 連接失敗？
A: 如果交易所 API 連接失敗：
1. 檢查 `.env` 文件中的 API 金鑰是否正確
2. 確認 API 金鑰具有適當的權限
3. 檢查網絡連接和防火牆設置
4. 查看後端日誌中的 API 錯誤信息

### Q: 雙腿下單執行失敗怎麼辦？
A: 系統現在具備完善的錯誤處理機制：
1. **Leg1 失敗**：立即標記失敗並結束執行
2. **Leg2 失敗**：自動回滾 Leg1，完成後標記失敗並結束
3. **執行異常**：捕獲異常並標記失敗狀態
4. **失敗記錄**：所有失敗都會記錄在執行歷史中
5. **前端通知**：失敗事件會即時推播到前端界面

### Q: Bybit 現貨報錯「Symbol is not supported on Margin Trading (ErrCode: 170344)」怎麼辦？
A: 這代表該現貨交易對不支援「現貨保證金（Margin）」模式。

- 系統處理方式：
  - 套利引擎 `arbitrage_engine` 針對現貨下單已不再預設傳入 `isLeverage=1`，改以現貨現金模式下單（不帶 `isLeverage` 參數）。
  - TWAP 引擎 `twap_engine` 預設以現貨現金模式下單；若偵測到 `170344`，會自動改用不帶 `isLeverage` 參數重試一次。
- 你需要做的事：通常不需要調整設定即可恢復；若自訂了槓桿現貨，請確認該交易對確實支援，否則請改用現貨現金模式。

### Q: 如何查看執行失敗記錄？
A: 可以通過以下方式查看：
1. **後端日誌**：查看 `arb_execution_failed` 相關日誌
2. **執行歷史**：通過 API 端點查看詳細的失敗記錄
3. **前端界面**：失敗事件會即時顯示在界面上

### Q: 如何刷新價格數據？
A: 系統提供多種價格刷新方式：
1. **自動刷新**：新增監控對時自動刷新價格數據
2. **手動刷新所有**：`POST /api/arbitrage/refresh-prices`
3. **手動刷新指定**：`POST /api/arbitrage/pairs/{pair_id}/refresh-prices`
4. **即時推送**：價格更新通過 WebSocket 即時推送到前端
5. **標記區分**：手動刷新的數據會標記 `refreshed: true`

### Q: 觸發次數顯示為 0 或消失？
A: 這通常是 WebSocket 消息處理問題，已修復：
1. **後端修復**：`arbitrageExecuted` 消息現在包含 `totalTriggers` 數據
2. **前端修復**：WebSocket 處理器正確更新觸發統計
3. **自動更新**：每次成功執行後觸發次數會自動增加
4. **即時顯示**：觸發次數會即時更新在監控對列表中

## ⚠️ 重要提醒

- **本系統使用真實交易平台（非測試網）**，所有交易都將在實際市場中執行
- 套利交易存在市場風險，請謹慎設定交易參數
- 建議從小額資金開始，逐步增加交易規模
- 請確保充足的資金餘額以應對市場波動
- **請確保您的API密鑰具有適當的權限設置**

## 📞 技術支援

如有任何問題或建議，請聯繫技術支援團隊。

---

**⚠️ 風險提示**：*本項目遵循最佳安全實踐，加密貨幣交易存在高風險，請在充分理解風險的前提下使用。*