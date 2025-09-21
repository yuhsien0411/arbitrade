# 多階段構建 Dockerfile
# 階段1: 構建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --only=production

COPY client/ ./
RUN npm run build

# 階段2: Python 後端
FROM python:3.11-slim

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 複製並安裝 Python 依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製後端代碼
COPY python_backend/ ./python_backend/

# 複製前端構建結果
COPY --from=frontend-builder /app/client/build ./client/build

# 創建非root用戶
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 7000

# 設置環境變量
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 啟動命令
CMD ["python", "-m", "uvicorn", "python_backend.app.main:app", "--host", "0.0.0.0", "--port", "7000"]
