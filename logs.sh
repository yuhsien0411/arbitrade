#!/bin/bash

# Arbitrade 日誌查看腳本
# 用於查看 Arbitrade 應用日誌

echo "📋 查看 Arbitrade 日誌..."

# 進入應用目錄
cd /opt/arbitrade

# 顯示日誌
docker-compose logs -f
