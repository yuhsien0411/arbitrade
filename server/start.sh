#!/bin/bash

# 檢查環境變數文件
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，從 .env.example 複製..."
    cp ../.env.example .env
    echo "✅ 已創建 .env 文件，請編輯並填入您的 API 密鑰"
    exit 1
fi

# 檢查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "14" ]; then
    echo "❌ Node.js 版本過低，需要 v14.0.0 或更高版本"
    exit 1
fi

# 安裝依賴
if [ ! -d "node_modules" ]; then
    echo "📦 安裝依賴..."
    npm install
fi

# 啟動服務
echo "🚀 啟動套利交易系統後端..."
npm start