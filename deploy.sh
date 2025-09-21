#!/bin/bash

# Arbitrade AWS EC2 部署腳本
# 作者: AI助手
# 版本: 1.0

set -e

echo "🚀 開始部署 Arbitrade 到 AWS EC2..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 檢查是否為 root 用戶
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "請不要使用 root 用戶運行此腳本"
        exit 1
    fi
}

# 更新系統
update_system() {
    log_info "更新系統套件..."
    sudo apt-get update
    sudo apt-get upgrade -y
    log_success "系統更新完成"
}

# 安裝 Docker
install_docker() {
    log_info "安裝 Docker..."
    
    if command -v docker &> /dev/null; then
        log_warning "Docker 已安裝，跳過安裝步驟"
        return
    fi
    
    # 安裝必要的套件
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # 添加 Docker 官方 GPG 密鑰
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 設置穩定版倉庫
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安裝 Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # 將當前用戶添加到 docker 群組
    sudo usermod -aG docker $USER
    
    log_success "Docker 安裝完成"
}

# 安裝 Docker Compose
install_docker_compose() {
    log_info "安裝 Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        log_warning "Docker Compose 已安裝，跳過安裝步驟"
        return
    fi
    
    # 下載 Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # 設置執行權限
    sudo chmod +x /usr/local/bin/docker-compose
    
    # 創建符號連結
    sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_success "Docker Compose 安裝完成"
}

# 安裝 Nginx
install_nginx() {
    log_info "安裝 Nginx..."
    
    if command -v nginx &> /dev/null; then
        log_warning "Nginx 已安裝，跳過安裝步驟"
        return
    fi
    
    sudo apt-get install -y nginx
    
    # 啟動並設置開機自啟
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    log_success "Nginx 安裝完成"
}

# 創建 SSL 證書
create_ssl_cert() {
    log_info "創建 SSL 證書..."
    
    # 創建 SSL 目錄
    sudo mkdir -p /etc/nginx/ssl
    
    # 生成自簽名證書 (生產環境請使用正式證書)
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/key.pem \
        -out /etc/nginx/ssl/cert.pem \
        -subj "/C=TW/ST=Taiwan/L=Taipei/O=Arbitrade/OU=IT/CN=localhost"
    
    # 設置權限
    sudo chmod 600 /etc/nginx/ssl/key.pem
    sudo chmod 644 /etc/nginx/ssl/cert.pem
    
    log_success "SSL 證書創建完成"
}

# 配置防火牆
configure_firewall() {
    log_info "配置防火牆..."
    
    # 安裝 UFW
    sudo apt-get install -y ufw
    
    # 設置默認策略
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # 允許 SSH
    sudo ufw allow ssh
    
    # 允許 HTTP 和 HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # 啟用防火牆
    sudo ufw --force enable
    
    log_success "防火牆配置完成"
}

# 創建應用目錄
create_app_directory() {
    log_info "創建應用目錄..."
    
    # 創建應用目錄
    sudo mkdir -p /opt/arbitrade
    sudo chown $USER:$USER /opt/arbitrade
    
    # 創建日誌目錄
    sudo mkdir -p /var/log/arbitrade
    sudo chown $USER:$USER /var/log/arbitrade
    
    log_success "應用目錄創建完成"
}

# 複製應用文件
copy_app_files() {
    log_info "複製應用文件..."
    
    # 複製所有文件到應用目錄
    cp -r . /opt/arbitrade/
    cd /opt/arbitrade
    
    # 設置權限
    chmod +x deploy.sh
    chmod +x start.sh
    chmod +x stop.sh
    
    log_success "應用文件複製完成"
}

# 構建和啟動應用
build_and_start_app() {
    log_info "構建和啟動應用..."
    
    cd /opt/arbitrade
    
    # 構建 Docker 鏡像
    docker-compose build
    
    # 啟動應用
    docker-compose up -d
    
    # 等待應用啟動
    sleep 30
    
    # 檢查應用狀態
    if docker-compose ps | grep -q "Up"; then
        log_success "應用啟動成功"
    else
        log_error "應用啟動失敗"
        docker-compose logs
        exit 1
    fi
}

# 配置 Nginx
configure_nginx() {
    log_info "配置 Nginx..."
    
    # 備份原始配置
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # 複製 Nginx 配置
    sudo cp nginx.conf /etc/nginx/nginx.conf
    
    # 測試 Nginx 配置
    sudo nginx -t
    
    # 重載 Nginx
    sudo systemctl reload nginx
    
    log_success "Nginx 配置完成"
}

# 創建系統服務
create_systemd_service() {
    log_info "創建系統服務..."
    
    # 創建 systemd 服務文件
    sudo tee /etc/systemd/system/arbitrade.service > /dev/null <<EOF
[Unit]
Description=Arbitrade Trading Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/arbitrade
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF

    # 重載 systemd
    sudo systemctl daemon-reload
    
    # 啟用服務
    sudo systemctl enable arbitrade.service
    
    log_success "系統服務創建完成"
}

# 創建管理腳本
create_management_scripts() {
    log_info "創建管理腳本..."
    
    # 創建啟動腳本
    cat > /opt/arbitrade/start.sh << 'EOF'
#!/bin/bash
cd /opt/arbitrade
docker-compose up -d
echo "Arbitrade 已啟動"
EOF

    # 創建停止腳本
    cat > /opt/arbitrade/stop.sh << 'EOF'
#!/bin/bash
cd /opt/arbitrade
docker-compose down
echo "Arbitrade 已停止"
EOF

    # 創建重啟腳本
    cat > /opt/arbitrade/restart.sh << 'EOF'
#!/bin/bash
cd /opt/arbitrade
docker-compose down
docker-compose up -d
echo "Arbitrade 已重啟"
EOF

    # 創建日誌查看腳本
    cat > /opt/arbitrade/logs.sh << 'EOF'
#!/bin/bash
cd /opt/arbitrade
docker-compose logs -f
EOF

    # 設置執行權限
    chmod +x /opt/arbitrade/*.sh
    
    log_success "管理腳本創建完成"
}

# 顯示部署結果
show_deployment_result() {
    log_info "部署完成！"
    echo ""
    echo "🎉 Arbitrade 已成功部署到 AWS EC2"
    echo ""
    echo "📋 部署信息："
    echo "  - 應用目錄: /opt/arbitrade"
    echo "  - 日誌目錄: /var/log/arbitrade"
    echo "  - 服務端口: 80 (HTTP) / 443 (HTTPS)"
    echo "  - 後端端口: 7000"
    echo ""
    echo "🔧 管理命令："
    echo "  - 啟動: sudo systemctl start arbitrade"
    echo "  - 停止: sudo systemctl stop arbitrade"
    echo "  - 重啟: sudo systemctl restart arbitrade"
    echo "  - 狀態: sudo systemctl status arbitrade"
    echo "  - 日誌: /opt/arbitrade/logs.sh"
    echo ""
    echo "🌐 訪問地址："
    echo "  - HTTP:  http://$(curl -s ifconfig.me)"
    echo "  - HTTPS: https://$(curl -s ifconfig.me)"
    echo ""
    echo "⚠️  注意事項："
    echo "  - 請配置您的 Bybit API 密鑰"
    echo "  - 生產環境請使用正式的 SSL 證書"
    echo "  - 定期備份重要數據"
    echo ""
}

# 主函數
main() {
    log_info "開始 Arbitrade AWS EC2 部署流程..."
    
    check_root
    update_system
    install_docker
    install_docker_compose
    install_nginx
    create_ssl_cert
    configure_firewall
    create_app_directory
    copy_app_files
    build_and_start_app
    configure_nginx
    create_systemd_service
    create_management_scripts
    show_deployment_result
    
    log_success "部署完成！"
}

# 執行主函數
main "$@"
