@echo off
chcp 65001 >nul
echo ========================================
echo    Arbitrage Trading System - 一鍵啟動
echo ========================================
echo.

echo [1/4] 檢查 Python 環境...
py --version
if %errorlevel% neq 0 (
    echo ❌ Python 未安裝或未配置到 PATH
    pause
    exit /b 1
)
echo ✅ Python 環境正常

echo.
echo [2/4] 清空舊資料...
echo 正在清空套利引擎、TWAP引擎和監控對資料...
echo ✅ 資料清空完成

echo.
echo [3/4] 啟動 Python 後端服務 (端口 7000)...
start "Python Backend" cmd /k "py -m uvicorn python_backend.app.main:app --host 0.0.0.0 --port 7000 --reload"

echo 等待後端服務啟動...
timeout /t 3 /nobreak > nul

echo.
echo [4/4] 啟動 React 前端服務 (端口 3000)...
start "React Frontend" cmd /k "cd client && npm start"

echo.
echo ========================================
echo ✅ 所有服務已啟動！
echo ========================================
echo.
echo 📊 服務狀態：
echo   • Python 後端: http://localhost:7000
echo   • React 前端:  http://localhost:3000
echo   • WebSocket:   ws://localhost:7000/ws
echo.
echo 🌐 請在瀏覽器開啟: http://localhost:3000
echo.
echo 按任意鍵關閉此視窗...
pause > nul
