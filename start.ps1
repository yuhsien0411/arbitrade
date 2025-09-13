# Arbitrage Trading System - 一鍵啟動腳本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Arbitrage Trading System - 一鍵啟動" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 Python 環境
Write-Host "[1/3] 檢查 Python 環境..." -ForegroundColor Yellow
try {
    $pythonVersion = py --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python 環境正常: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python 未安裝或未配置到 PATH"
    }
} catch {
    Write-Host "❌ Python 環境檢查失敗: $_" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 檢查 Node.js 環境
Write-Host ""
Write-Host "[2/3] 檢查 Node.js 環境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js 環境正常: $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js 未安裝或未配置到 PATH"
    }
} catch {
    Write-Host "❌ Node.js 環境檢查失敗: $_" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 啟動 Python 後端
Write-Host ""
Write-Host "[3/4] 啟動 Python 後端服務 (端口 7000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "py -m uvicorn python_backend.app.main:app --host 0.0.0.0 --port 7000 --reload"

Write-Host "等待後端服務啟動..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 啟動 React 前端
Write-Host ""
Write-Host "[4/4] 啟動 React 前端服務 (端口 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm start"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ 所有服務已啟動！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 服務狀態：" -ForegroundColor White
Write-Host "  • Python 後端: http://localhost:7000" -ForegroundColor Gray
Write-Host "  • React 前端:  http://localhost:3000" -ForegroundColor Gray
Write-Host "  • WebSocket:   ws://localhost:7000/ws" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 請在瀏覽器開啟: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "按任意鍵關閉此視窗..." -ForegroundColor Gray
Read-Host
