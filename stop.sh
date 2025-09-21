#!/bin/bash

# Arbitrade 停止腳本
# 用於停止 Arbitrade 應用

echo "🛑 停止 Arbitrade..."

# 進入應用目錄
cd /opt/arbitrade

# 停止應用
docker-compose down

echo "✅ Arbitrade 已停止"
