@echo off
echo ========================================
echo    Arbitrage Trading System - 狀態檢查
echo ========================================
echo.

echo [1/3] 檢查 Python 後端 (端口 7000)...
curl -s http://localhost:7000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Python 後端運行正常
) else (
    echo ❌ Python 後端未運行
)

echo.
echo [2/3] 檢查 React 前端 (端口 3000)...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ React 前端運行正常
) else (
    echo ❌ React 前端未運行
)

echo.
echo [3/3] 檢查進程狀態...
echo Python 進程:
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if %errorlevel% equ 0 (
    echo ✅ Python 進程運行中
) else (
    echo ❌ 沒有 Python 進程
)

echo.
echo Node.js 進程:
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %errorlevel% equ 0 (
    echo ✅ Node.js 進程運行中
) else (
    echo ❌ 沒有 Node.js 進程
)

echo.
echo ========================================
echo 檢查完成！
echo ========================================
echo.
pause
