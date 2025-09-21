# ✅ AWS EC2 部署檢查清單

## 📋 部署前準備

### AWS 設置
- [ ] 創建 AWS 帳戶
- [ ] 啟動 EC2 實例 (Ubuntu 20.04+)
- [ ] 配置安全群組 (開放 22, 80, 443 端口)
- [ ] 獲取實例公網 IP 地址
- [ ] 下載或創建 SSH 密鑰對

### 本地準備
- [ ] 準備 Bybit API 密鑰
- [ ] 確保項目文件完整
- [ ] 準備部署腳本

## 🚀 部署步驟

### 第一步：連接實例
- [ ] 使用 SSH 連接到 EC2 實例
- [ ] 確認可以正常登入

### 第二步：上傳文件
- [ ] 上傳項目文件到實例
- [ ] 確認文件完整性

### 第三步：執行部署
- [ ] 設置腳本執行權限
- [ ] 執行 `./deploy.sh`
- [ ] 等待部署完成

### 第四步：配置應用
- [ ] 編輯 `.env` 文件
- [ ] 添加 Bybit API 密鑰
- [ ] 重啟應用服務

### 第五步：驗證部署
- [ ] 檢查應用狀態
- [ ] 訪問 HTTP 地址
- [ ] 訪問 HTTPS 地址
- [ ] 測試 API 連接

## 🔧 部署後配置

### 安全設置
- [ ] 配置防火牆規則
- [ ] 設置 SSL 證書 (生產環境)
- [ ] 定期更新系統

### 監控設置
- [ ] 設置日誌監控
- [ ] 配置性能監控
- [ ] 設置告警機制

### 備份設置
- [ ] 設置自動備份
- [ ] 測試備份恢復
- [ ] 文檔化備份流程

## ✅ 部署完成檢查

### 功能測試
- [ ] 前端界面正常載入
- [ ] 後端 API 正常響應
- [ ] WebSocket 連接正常
- [ ] 交易所 API 連接正常

### 性能測試
- [ ] 頁面載入速度正常
- [ ] API 響應時間正常
- [ ] 記憶體使用正常
- [ ] CPU 使用正常

### 安全測試
- [ ] HTTPS 證書正常
- [ ] 防火牆規則正確
- [ ] API 密鑰安全存儲
- [ ] 日誌記錄正常

## 🚨 故障排除

### 常見問題
- [ ] 應用無法啟動 → 檢查 Docker 狀態
- [ ] 端口無法訪問 → 檢查安全群組
- [ ] API 連接失敗 → 檢查密鑰配置
- [ ] SSL 證書錯誤 → 檢查證書配置

### 日誌檢查
- [ ] 應用日誌：`/opt/arbitrade/logs.sh`
- [ ] 系統日誌：`sudo journalctl -u arbitrade`
- [ ] Nginx 日誌：`sudo tail -f /var/log/nginx/error.log`

## 📞 支援資源

### 文檔參考
- [ ] 詳細部署指南：`AWS_DEPLOYMENT_GUIDE.md`
- [ ] 快速部署指南：`QUICK_DEPLOY.md`
- [ ] 項目說明：`README.md`

### 管理命令
- [ ] 啟動：`sudo systemctl start arbitrade`
- [ ] 停止：`sudo systemctl stop arbitrade`
- [ ] 重啟：`sudo systemctl restart arbitrade`
- [ ] 狀態：`sudo systemctl status arbitrade`
- [ ] 日誌：`/opt/arbitrade/logs.sh`

---

**🎉 恭喜！** 如果您完成了所有檢查項目，您的 Arbitrade 套利交易平台已成功部署到 AWS EC2！
