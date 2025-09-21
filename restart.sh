#!/bin/bash

# Arbitrade 重啟腳本
# 用於重啟 Arbitrade 應用

echo "🔄 重啟 Arbitrade..."

# 進入應用目錄
cd /opt/arbitrade

# 停止應用
echo "⏹️  停止應用..."
docker-compose down

# 等待完全停止
sleep 5

# 啟動應用
echo "🚀 啟動應用..."
docker-compose up -d

# 等待應用啟動
echo "⏳ 等待應用啟動..."
sleep 10

# 檢查應用狀態
if docker-compose ps | grep -q "Up"; then
    echo "✅ Arbitrade 已成功重啟"
    echo ""
    echo "🌐 訪問地址："
    echo "  - HTTP:  http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"
    echo "  - HTTPS: https://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"
else
    echo "❌ 應用重啟失敗"
    echo "📋 查看日誌:"
    docker-compose logs
    exit 1
fi
