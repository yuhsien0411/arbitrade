# 🔐 環境變數設定指南

## 📋 概述

系統現在使用 `.env` 檔案來管理 API 金鑰和敏感設定，提供更安全的方式來處理敏感資訊。

## 🚀 快速開始

### 1. 複製環境變數範本
```bash
copy env.example .env
```

### 2. 編輯 .env 檔案
```bash
notepad .env
```

### 3. 填入真實的 API 金鑰
```env
# Bybit API 設定
BYBIT_API_KEY=your_real_bybit_api_key
BYBIT_SECRET=your_real_bybit_secret

# Binance API 設定  
BINANCE_API_KEY=your_real_binance_api_key
BINANCE_SECRET=your_real_binance_secret

# 系統設定
DEBUG=true
LOG_LEVEL=INFO
```

## 🔧 環境變數說明

### 交易所 API 設定
| 變數名稱 | 說明 | 範例 |
|---------|------|------|
| `BYBIT_API_KEY` | Bybit API 金鑰 | `abc123...` |
| `BYBIT_SECRET` | Bybit API 密鑰 | `def456...` |
| `BINANCE_API_KEY` | Binance API 金鑰 | `ghi789...` |
| `BINANCE_SECRET` | Binance API 密鑰 | `jkl012...` |

### 系統設定
| 變數名稱 | 說明 | 預設值 | 選項 |
|---------|------|--------|------|
| `DEBUG` | 除錯模式 | `false` | `true`/`false` |
| `LOG_LEVEL` | 日誌等級 | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR` |

## 🛡️ 安全注意事項

### ✅ 安全做法
- ✅ 將 `.env` 加入 `.gitignore`
- ✅ 不要將 `.env` 檔案提交到版本控制
- ✅ 定期輪換 API 金鑰
- ✅ 限制 API 金鑰權限範圍

### ❌ 避免做法
- ❌ 不要在程式碼中硬編碼 API 金鑰
- ❌ 不要將 `.env` 檔案分享給他人
- ❌ 不要在日誌中記錄 API 金鑰

## 🔄 重新載入設定

修改 `.env` 檔案後，需要重新啟動後端服務：

```bash
# 停止服務
stop.bat

# 重新啟動
start.bat
```

## 📊 API 狀態檢查

### 檢查 API 設定狀態
```bash
GET /api/settings/api
```

**回應範例：**
```json
{
  "success": true,
  "data": {
    "bybit": {
      "connected": true,
      "publicOnly": false,
      "hasApiKey": true,
      "hasSecret": true
    },
    "binance": {
      "connected": false,
      "publicOnly": true,
      "hasApiKey": false,
      "hasSecret": false
    }
  }
}
```

### 測試 API 連接
```bash
POST /api/settings/api/test
```

**回應範例：**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "exchanges": ["bybit"]
  }
}
```

## 🐛 故障排除

### 問題：API 設定未生效
**解決方案：**
1. 檢查 `.env` 檔案是否存在
2. 確認環境變數名稱正確
3. 重新啟動後端服務

### 問題：API 金鑰無效
**解決方案：**
1. 檢查 API 金鑰是否正確
2. 確認 API 金鑰權限設定
3. 檢查交易所 API 狀態

### 問題：環境變數未載入
**解決方案：**
1. 確認 `.env` 檔案在專案根目錄
2. 檢查檔案編碼為 UTF-8
3. 重新安裝 `python-dotenv` 套件

## 📝 範例 .env 檔案

```env
# 交易所 API 設定
BYBIT_API_KEY=abc123def456ghi789
BYBIT_SECRET=xyz789uvw456rst123
BINANCE_API_KEY=mno456pqr789stu012
BINANCE_SECRET=vwx345yza678bcd901

# 系統設定
DEBUG=true
LOG_LEVEL=INFO
```

## 🎯 下一步

1. 設定你的 API 金鑰
2. 重新啟動服務
3. 檢查 API 連接狀態
4. 開始使用 TWAP 策略功能

---

**注意：** 請確保妥善保管你的 API 金鑰，不要分享給他人！
