# 🚀 Arbitrade AWS EC2 部署指南

## 📋 概述

本指南將幫助您將 Arbitrade 套利交易平台部署到 AWS EC2 實例上。我們使用 Docker 容器化技術和 Nginx 反向代理來確保應用的穩定運行。

## 🎯 部署架構

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用戶瀏覽器     │    │   AWS EC2       │    │   交易所API     │
│                 │    │                 │    │                 │
│  HTTPS (443)    │◄──►│  Nginx (80/443) │◄──►│  Bybit API      │
│  HTTP (80)      │    │  ┌─────────────┐│    │  Binance API    │
│                 │    │  │Arbitrade App││    │  OKX API        │
│                 │    │  │Docker:7000  ││    │  ...            │
│                 │    │  └─────────────┘│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 系統要求

### AWS EC2 實例規格
- **實例類型**: t3.medium 或更高 (建議 t3.large)
- **操作系統**: Ubuntu 20.04 LTS 或更新版本
- **記憶體**: 最少 4GB RAM
- **儲存空間**: 最少 20GB SSD
- **網路**: 公網 IP 地址

### 安全群組設置
確保以下端口開放：
- **22**: SSH 連接
- **80**: HTTP 訪問
- **443**: HTTPS 訪問

## 📦 部署步驟

### 第一步：啟動 AWS EC2 實例

1. **選擇 AMI**
   - 在 AWS 控制台選擇 "Amazon Linux 2023" 或 "Ubuntu 20.04 LTS"
   - 確保選擇的 AMI 符合免費套餐條件（如適用）

2. **選擇實例類型**
   - 推薦：t3.medium (2 vCPU, 4GB RAM)
   - 最小：t3.micro (2 vCPU, 1GB RAM) - 僅用於測試

3. **配置安全群組**
   ```
   類型          協議    端口範圍    來源
   SSH          TCP     22         0.0.0.0/0
   HTTP         TCP     80         0.0.0.0/0
   HTTPS        TCP     443        0.0.0.0/0
   ```

4. **啟動實例**
   - 選擇或創建密鑰對
   - 啟動實例並記錄公網 IP 地址

### 第二步：連接到 EC2 實例

```bash
# 使用 SSH 連接到實例
ssh -i your-key.pem ubuntu@your-ec2-ip

# 或者使用密碼登入（如果已設置）
ssh ubuntu@your-ec2-ip
```

### 第三步：上傳項目文件

#### 方法一：使用 SCP 上傳
```bash
# 在本地電腦上執行
scp -i your-key.pem -r . ubuntu@your-ec2-ip:/home/ubuntu/arbitrade/
```

#### 方法二：使用 Git 克隆
```bash
# 在 EC2 實例上執行
git clone https://github.com/your-username/arbitrade.git
cd arbitrade
```

### 第四步：執行自動部署腳本

```bash
# 設置執行權限
chmod +x deploy.sh

# 執行部署腳本
./deploy.sh
```

部署腳本會自動完成以下操作：
- ✅ 更新系統套件
- ✅ 安裝 Docker 和 Docker Compose
- ✅ 安裝 Nginx
- ✅ 創建 SSL 證書
- ✅ 配置防火牆
- ✅ 構建和啟動應用
- ✅ 配置 Nginx 反向代理
- ✅ 創建系統服務

### 第五步：配置 API 密鑰

1. **編輯環境配置文件**
   ```bash
   sudo nano /opt/arbitrade/.env
   ```

2. **添加您的 Bybit API 密鑰**
   ```env
   BYBIT_API_KEY=your_api_key_here
   BYBIT_API_SECRET=your_api_secret_here
   BYBIT_TESTNET=false
   ```

3. **重啟應用**
   ```bash
   sudo systemctl restart arbitrade
   ```

## 🌐 訪問應用

部署完成後，您可以通過以下方式訪問應用：

- **HTTP**: `http://your-ec2-ip`
- **HTTPS**: `https://your-ec2-ip`

## 🔧 管理命令

### 系統服務管理
```bash
# 啟動服務
sudo systemctl start arbitrade

# 停止服務
sudo systemctl stop arbitrade

# 重啟服務
sudo systemctl restart arbitrade

# 查看服務狀態
sudo systemctl status arbitrade

# 啟用開機自啟
sudo systemctl enable arbitrade
```

### 應用管理腳本
```bash
# 啟動應用
/opt/arbitrade/start.sh

# 停止應用
/opt/arbitrade/stop.sh

# 重啟應用
/opt/arbitrade/restart.sh

# 查看日誌
/opt/arbitrade/logs.sh
```

### Docker 管理
```bash
# 進入應用目錄
cd /opt/arbitrade

# 查看容器狀態
docker-compose ps

# 查看日誌
docker-compose logs -f

# 重啟特定服務
docker-compose restart arbitrade-app

# 更新應用
docker-compose pull
docker-compose up -d
```

## 📊 監控和日誌

### 應用日誌
```bash
# 查看應用日誌
/opt/arbitrade/logs.sh

# 查看特定服務日誌
docker-compose logs arbitrade-app

# 查看 Nginx 日誌
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 系統監控
```bash
# 查看系統資源使用
htop

# 查看磁盤使用
df -h

# 查看記憶體使用
free -h

# 查看網路連接
netstat -tulpn
```

## 🔒 安全配置

### SSL 證書配置
目前使用自簽名證書，生產環境建議：

1. **使用 Let's Encrypt 免費證書**
   ```bash
   # 安裝 Certbot
   sudo apt-get install certbot python3-certbot-nginx
   
   # 獲取證書
   sudo certbot --nginx -d your-domain.com
   ```

2. **使用商業 SSL 證書**
   - 購買 SSL 證書
   - 上傳證書到 `/etc/nginx/ssl/`
   - 更新 Nginx 配置

### 防火牆配置
```bash
# 查看防火牆狀態
sudo ufw status

# 添加規則
sudo ufw allow from 192.168.1.0/24 to any port 22

# 刪除規則
sudo ufw delete allow 80
```

## 🚨 故障排除

### 常見問題

#### 1. 應用無法啟動
```bash
# 檢查 Docker 狀態
sudo systemctl status docker

# 檢查容器日誌
docker-compose logs

# 檢查端口占用
sudo netstat -tulpn | grep :7000
```

#### 2. Nginx 配置錯誤
```bash
# 測試 Nginx 配置
sudo nginx -t

# 重載 Nginx 配置
sudo systemctl reload nginx

# 查看 Nginx 錯誤日誌
sudo tail -f /var/log/nginx/error.log
```

#### 3. 端口無法訪問
```bash
# 檢查安全群組設置
# 確保 AWS 安全群組中開放 80 和 443 端口

# 檢查本地防火牆
sudo ufw status

# 檢查應用是否監聽正確端口
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

#### 4. API 連接問題
```bash
# 檢查環境變量
cat /opt/arbitrade/.env

# 檢查 API 密鑰配置
# 確保 Bybit API 密鑰正確設置

# 查看應用日誌
docker-compose logs arbitrade-app
```

### 日誌分析
```bash
# 查看系統日誌
sudo journalctl -u arbitrade -f

# 查看 Docker 日誌
docker-compose logs --tail=100 -f

# 查看 Nginx 訪問日誌
sudo tail -f /var/log/nginx/access.log | grep -v "health"
```

## 📈 性能優化

### 1. 增加實例規格
- 升級到更大的實例類型
- 增加記憶體和 CPU 資源

### 2. 優化 Docker 配置
```bash
# 限制容器資源使用
# 在 docker-compose.yml 中添加：
services:
  arbitrade-app:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

### 3. 優化 Nginx 配置
```bash
# 啟用 Gzip 壓縮
# 調整 worker 進程數
# 配置緩存策略
```

## 🔄 更新和維護

### 應用更新
```bash
# 進入應用目錄
cd /opt/arbitrade

# 拉取最新代碼
git pull origin main

# 重新構建和啟動
docker-compose down
docker-compose build
docker-compose up -d
```

### 系統更新
```bash
# 更新系統套件
sudo apt-get update && sudo apt-get upgrade -y

# 重啟系統
sudo reboot
```

### 備份重要數據
```bash
# 備份應用配置
sudo tar -czf arbitrade-backup-$(date +%Y%m%d).tar.gz /opt/arbitrade

# 備份 Nginx 配置
sudo cp /etc/nginx/nginx.conf /opt/arbitrade/backup/
```

## 📞 技術支援

如果您在部署過程中遇到問題，請：

1. 查看本文檔的故障排除部分
2. 檢查應用日誌和系統日誌
3. 確認 AWS 安全群組設置
4. 驗證 API 密鑰配置

## 🎉 部署完成

恭喜！您已成功將 Arbitrade 部署到 AWS EC2。現在您可以：

1. 通過瀏覽器訪問應用
2. 配置您的交易參數
3. 開始使用套利交易功能

記住定期備份重要數據，並監控系統運行狀況。

---

**⚠️ 重要提醒**：
- 本系統使用真實交易平台，請謹慎操作
- 定期檢查系統日誌和性能
- 確保 API 密鑰安全
- 建議在生產環境使用正式 SSL 證書
