# 使用 Node.js 官方映像
FROM node:18-alpine

# 設置工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製應用程式代碼
COPY . .

# 創建非 root 用戶
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 切換到非 root 用戶
USER nodejs

# 暴露端口
EXPOSE 5000

# 啟動應用
CMD ["node", "index.js"]