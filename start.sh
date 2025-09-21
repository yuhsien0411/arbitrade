#!/bin/bash

# Arbitrade 啟動腳本
# 用於快速啟動 Arbitrade 應用

set -e

echo "🚀 啟動 Arbitrade..."

# 檢查 Docker 是否運行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未運行，請先啟動 Docker"
    exit 1
fi

# 進入應用目錄
cd /opt/arbitrade

# 啟動應用
docker-compose up -d

# 等待應用啟動
echo "⏳ 等待應用啟動..."
sleep 10

# 檢查應用狀態
if docker-compose ps | grep -q "Up"; then
    echo "✅ Arbitrade 已成功啟動"
    echo ""
    echo "🌐 訪問地址："
    echo "  - HTTP:  http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"
    echo "  - HTTPS: https://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"
    echo ""
    echo "📊 查看日誌: /opt/arbitrade/logs.sh"
    echo "🛑 停止應用: /opt/arbitrade/stop.sh"
else
    echo "❌ 應用啟動失敗"
    echo "📋 查看日誌:"
    docker-compose logs
    exit 1
fi
