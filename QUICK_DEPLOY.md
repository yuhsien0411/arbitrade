# ⚡ Arbitrade 快速部署指南

## 🎯 一鍵部署到 AWS EC2

### 前提條件
- AWS 帳戶
- EC2 實例 (Ubuntu 20.04+)
- 公網 IP 地址

### 快速開始

#### 1. 連接到 EC2 實例
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

#### 2. 上傳項目文件
```bash
# 方法一：使用 SCP
scp -i your-key.pem -r . ubuntu@your-ec2-ip:/home/ubuntu/arbitrade/

# 方法二：使用 Git
git clone https://github.com/your-username/arbitrade.git
cd arbitrade
```

#### 3. 執行自動部署
```bash
chmod +x deploy.sh
./deploy.sh
```

#### 4. 配置 API 密鑰
```bash
sudo nano /opt/arbitrade/.env
# 添加您的 Bybit API 密鑰
```

#### 5. 重啟應用
```bash
sudo systemctl restart arbitrade
```

### 🌐 訪問應用
- **HTTP**: `http://your-ec2-ip`
- **HTTPS**: `https://your-ec2-ip`

### 🔧 常用命令
```bash
# 啟動
sudo systemctl start arbitrade

# 停止
sudo systemctl stop arbitrade

# 重啟
sudo systemctl restart arbitrade

# 查看日誌
/opt/arbitrade/logs.sh

# 查看狀態
sudo systemctl status arbitrade
```

### ⚠️ 注意事項
1. 確保安全群組開放 80 和 443 端口
2. 配置正確的 Bybit API 密鑰
3. 生產環境建議使用正式 SSL 證書

---
**🎉 部署完成！** 現在您可以開始使用 Arbitrade 套利交易平台了。
