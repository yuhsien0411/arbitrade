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
python -m uvicorn app.main:app --host 0.0.0.0 --port 7000

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

## ❓ 常見問題

### Q: 啟動失敗怎麼辦？
A: 請檢查：
1. Docker 是否正在運行
2. 端口 3000 和 7000 是否被佔用
3. `.env` 文件中的 API 密鑰是否正確

### Q: 如何查看錯誤日誌？
A: 運行 `docker-compose logs -f` 查看詳細日誌

### Q: 如何停止服務？
A: 運行 `docker-compose down` 停止所有服務

### Q: 如何重新配置？
A: 編輯 `.env` 文件後運行 `docker-compose restart`

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