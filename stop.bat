@echo off
echo ========================================
echo    Arbitrage Trading System - 停止服務
echo ========================================
echo.

echo 正在停止所有服務...

echo [1/2] 停止 Node.js 進程...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Node.js 進程已停止
) else (
    echo ⚠️  沒有找到 Node.js 進程
)

echo.
echo [2/2] 停止 Python 進程...
taskkill /F /IM python.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Python 進程已停止
) else (
    echo ⚠️  沒有找到 Python 進程
)

echo.
echo ========================================
echo ✅ 所有服務已停止！
echo ========================================
echo.
pause
