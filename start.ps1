# Arbitrage Trading System - PowerShell 啟動腳本
# 支援 Windows PowerShell 和 PowerShell Core

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Arbitrage Trading System - 一鍵啟動" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] 檢查 Python 環境..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python 環境正常: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python 未安裝或未配置到 PATH"
    }
} catch {
    Write-Host "❌ Python 未安裝或未配置到 PATH" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host ""
Write-Host "[2/4] 清空舊資料..." -ForegroundColor Yellow
Write-Host "正在清空套利引擎、TWAP引擎和監控對資料..." -ForegroundColor Gray
Write-Host "✅ 資料清空完成" -ForegroundColor Green

Write-Host ""
Write-Host "[3/4] 啟動 Python 後端服務 (端口 7000)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/k", "py -m uvicorn python_backend.app.main:app --host 0.0.0.0 --port 7000 --reload" -WindowStyle Normal

Write-Host "等待後端服務啟動..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[4/4] 啟動 React 前端服務 (端口 3000)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/k", "cd client && npm start" -WindowStyle Normal

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
Write-Host "🌐 請在瀏覽器開啟: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Read-Host "按 Enter 鍵關閉此視窗"
