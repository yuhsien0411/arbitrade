from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal, List, Dict, Any
import time
import os

from ..utils.http import get_http_client
from ..utils.logger import get_logger
from ..config import config
from ..utils.env_manager import env_manager


router = APIRouter()
logger = get_logger()


ExchangeName = Literal["bybit", "binance"]


class ExchangeStatus(BaseModel):
    name: str
    connected: bool
    publicOnly: bool


class AccountBalance(BaseModel):
    asset: str
    free: float


class AccountInfo(BaseModel):
    balances: List[AccountBalance]
    positions: List[Dict[str, Any]] = []


async def _check_exchange_status(exchange: ExchangeName) -> ExchangeStatus:
    """檢查交易所連線狀態"""
    client = await get_http_client()
    
    if exchange == "bybit":
        try:
            url = "https://api.bybit.com/v5/market/time"
            r = await client.get(url, timeout=5.0)
            connected = r.status_code == 200
        except Exception:
            connected = False
    elif exchange == "binance":
        try:
            url = "https://api.binance.com/api/v3/time"
            r = await client.get(url, timeout=5.0)
            connected = r.status_code == 200
        except Exception:
            connected = False
    else:
        connected = False
    
    return ExchangeStatus(
        name=exchange,
        connected=connected,
        publicOnly=True  # 目前僅支援公開API
    )


@router.get("/exchanges")
async def get_exchanges():
    """取得所有支援的交易所狀態"""
    exchanges = []
    for exchange in ["bybit", "binance"]:
        status = await _check_exchange_status(exchange)
        exchanges.append(status)
    
    return {"success": True, "data": exchanges}


@router.get("/account/{exchange}")
async def get_account(exchange: ExchangeName):
    """取得指定交易所帳戶資訊（目前僅公開API，回傳模擬資料）"""
    # 檢查交易所連線狀態
    status = await _check_exchange_status(exchange)
    if not status.connected:
        raise HTTPException(
            status_code=503, 
            detail={"code": "EXCHANGE_UNAVAILABLE", "message": f"{exchange} unavailable"}
        )
    
    # 目前僅支援公開API，回傳模擬資料
    # 後續階段會整合真實的帳戶API
    mock_balances = [
        {"asset": "USDT", "free": 1000.0},
        {"asset": "BTC", "free": 0.0},
        {"asset": "ETH", "free": 0.0}
    ]
    
    return {
        "success": True,
        "data": {
            "balances": mock_balances,
            "positions": []
        }
    }


@router.get("/settings/api")
async def get_api_settings():
    """取得 API 設定狀態（從環境變數讀取）"""
    # 從環境變數讀取設定
    exchanges_config = config.get_all_exchanges_config()
    
    # 不返回實際的 API Key 和 Secret
    safe_data = {}
    for exchange, exchange_config in exchanges_config.items():
        safe_data[exchange] = {
            "connected": exchange_config["connected"],
            "publicOnly": exchange_config["publicOnly"],
            "hasApiKey": bool(exchange_config["apiKey"]),
            "hasSecret": bool(exchange_config["secret"])
        }
    
    return {"success": True, "data": safe_data}


@router.get("/settings/api/edit")
async def get_api_settings_for_edit():
    """取得 API 設定用於編輯（返回實際的 API Key 和 Secret 值）"""
    exchanges_config = config.get_all_exchanges_config()
    
    # 返回編輯用的資料（包含實際的 API Key 和 Secret）
    edit_data = {}
    for exchange, exchange_config in exchanges_config.items():
        edit_data[exchange] = {
            "apiKey": exchange_config["apiKey"] or "",
            "secret": exchange_config["secret"] or "",
            "hasApiKey": bool(exchange_config["apiKey"]),
            "hasSecret": bool(exchange_config["secret"]),
            "connected": exchange_config["connected"],
            "publicOnly": exchange_config["publicOnly"]
        }
    
    return {"success": True, "data": edit_data}


@router.put("/settings/api")
async def update_api_settings(settings: dict):
    """更新 API 設定（直接更新 .env 檔案）"""
    try:
        logger.info("api_settings_update_requested", exchanges=list(settings.keys()))
        
        # 更新 .env 檔案中的 API 設定
        for exchange, exchange_config in settings.items():
            if exchange in ["bybit", "binance"]:
                api_key = exchange_config.get("apiKey")
                secret = exchange_config.get("secret")
                
                # 更新 .env 檔案
                success = env_manager.update_api_keys(
                    exchange=exchange,
                    api_key=api_key,
                    secret=secret
                )
                
                if not success:
                    raise Exception(f"更新 {exchange} API 設定失敗")
        
        # 重新載入配置
        import os
        from dotenv import load_dotenv
        from pathlib import Path
        
        # 重新載入 .env 檔案
        env_path = Path(__file__).parent.parent.parent.parent / ".env"
        load_dotenv(env_path, override=True)
        
        # 直接更新環境變數
        os.environ['BYBIT_API_KEY'] = os.getenv('BYBIT_API_KEY', '')
        os.environ['BYBIT_SECRET'] = os.getenv('BYBIT_SECRET', '')
        os.environ['BINANCE_API_KEY'] = os.getenv('BINANCE_API_KEY', '')
        os.environ['BINANCE_SECRET'] = os.getenv('BINANCE_SECRET', '')
        
        # 重新載入配置模組
        from ..config import EnvConfig
        import importlib
        import sys
        
        config_module = sys.modules['app.config']
        importlib.reload(config_module)
        
        # 更新全域配置
        global config
        config = config_module.config
        
        logger.info("api_settings_updated", exchanges=list(settings.keys()))
        return {"success": True, "data": {"message": "API 設定已更新並保存到 .env 檔案"}}
        
    except Exception as e:
        logger.error("api_settings_update_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"更新 API 設定失敗: {str(e)}"}
        )


@router.post("/settings/api/test")
async def test_api_connection(request: dict = None):
    """測試 API 連接（從環境變數讀取）"""
    # 從請求中獲取要測試的交易所，如果沒有指定則測試所有
    target_exchange = None
    if request and "exchange" in request:
        target_exchange = request["exchange"].lower()
    
    exchanges_config = config.get_all_exchanges_config()
    connected_exchanges = []
    test_results = {}
    
    for exchange, exchange_config in exchanges_config.items():
        # 如果指定了特定交易所，只測試該交易所
        if target_exchange and exchange.lower() != target_exchange:
            continue
        if exchange_config["apiKey"] and exchange_config["secret"]:
            try:
                if exchange.lower() == "bybit":
                    # 測試 Bybit API 連接
                    from pybit.unified_trading import HTTP
                    
                    # 檢查是否使用測試網（可以從環境變數讀取）
                    use_testnet = os.getenv('BYBIT_TESTNET', 'false').lower() == 'true'
                    
                    session = HTTP(
                        testnet=use_testnet,
                        api_key=exchange_config["apiKey"],
                        api_secret=exchange_config["secret"]
                    )
                    
                    # 測試 API 連接：獲取帳戶信息
                    account_info = session.get_account_info()
                    
                    if account_info.get("retCode") == 0:
                        connected_exchanges.append(exchange)
                        result = account_info.get("result", {})
                        
                        # 解析帳戶狀態
                        unified_margin_status_map = {
                            1: "經典帳戶",
                            3: "統一帳戶1.0",
                            4: "統一帳戶1.0 (pro版本)",
                            5: "統一帳戶2.0",
                            6: "統一帳戶2.0 (pro版本)"
                        }
                        
                        margin_mode_map = {
                            "ISOLATED_MARGIN": "逐倉保證金",
                            "REGULAR_MARGIN": "全倉保證金",
                            "PORTFOLIO_MARGIN": "組合保證金"
                        }
                        
                        test_results[exchange] = {
                            "success": True,
                            "message": "API 連接成功",
                            "account_info": {
                                "marginMode": result.get("marginMode", ""),
                                "marginModeText": margin_mode_map.get(result.get("marginMode", ""), result.get("marginMode", "")),
                                "unifiedMarginStatus": result.get("unifiedMarginStatus", 0),
                                "unifiedMarginStatusText": unified_margin_status_map.get(result.get("unifiedMarginStatus", 0), f"未知狀態({result.get('unifiedMarginStatus', 0)})"),
                                "isMasterTrader": result.get("isMasterTrader", False),
                                "spotHedgingStatus": result.get("spotHedgingStatus", ""),
                                "spotHedgingStatusText": "已開啟" if result.get("spotHedgingStatus") == "ON" else "未開啟",
                                "updatedTime": result.get("updatedTime", ""),
                                "dcpStatus": result.get("dcpStatus", ""),
                                "timeWindow": result.get("timeWindow", 0),
                                "smpGroup": result.get("smpGroup", 0)
                            }
                        }
                    else:
                        test_results[exchange] = {
                            "success": False,
                            "message": f"API 連接失敗: {account_info.get('retMsg', '未知錯誤')}",
                            "error_code": account_info.get("retCode", -1)
                        }
                        
                elif exchange.lower() == "binance":
                    # 測試 Binance API 連接
                    import requests
                    import time
                    import hmac
                    import hashlib
                    from urllib.parse import urlencode
                    
                    # 創建簽名
                    timestamp = int(time.time() * 1000)
                    query_string = f"timestamp={timestamp}"
                    signature = hmac.new(
                        exchange_config["secret"].encode('utf-8'),
                        query_string.encode('utf-8'),
                        hashlib.sha256
                    ).hexdigest()
                    
                    # 測試 API 連接：獲取帳戶信息
                    url = "https://api.binance.com/api/v3/account"
                    params = {
                        "timestamp": timestamp,
                        "signature": signature
                    }
                    headers = {
                        "X-MBX-APIKEY": exchange_config["apiKey"]
                    }
                    
                    response = requests.get(url, params=params, headers=headers, timeout=10)
                    
                    if response.status_code == 200:
                        connected_exchanges.append(exchange)
                        account_data = response.json()
                        
                        # 解析 Binance 帳戶信息
                        test_results[exchange] = {
                            "success": True,
                            "message": "API 連接成功",
                            "account_info": {
                                "makerCommission": account_data.get("makerCommission", 0),
                                "takerCommission": account_data.get("takerCommission", 0),
                                "buyerCommission": account_data.get("buyerCommission", 0),
                                "sellerCommission": account_data.get("sellerCommission", 0),
                                "canTrade": account_data.get("canTrade", False),
                                "canWithdraw": account_data.get("canWithdraw", False),
                                "canDeposit": account_data.get("canDeposit", False),
                                "updateTime": account_data.get("updateTime", 0),
                                "accountType": account_data.get("accountType", ""),
                                "balances": account_data.get("balances", [])[:5],  # 只顯示前5個餘額
                                "permissions": account_data.get("permissions", [])
                            }
                        }
                    else:
                        test_results[exchange] = {
                            "success": False,
                            "message": f"API 連接失敗: {response.text}",
                            "error_code": response.status_code
                        }
                        
            except Exception as e:
                test_results[exchange] = {
                    "success": False,
                    "message": f"API 連接測試失敗: {str(e)}"
                }
        else:
            test_results[exchange] = {
                "success": False,
                "message": "API Key 或 Secret 未配置"
            }
    
    return {
        "success": True, 
        "data": {
            "connected": len(connected_exchanges) > 0,
            "exchanges": connected_exchanges,
            "test_results": test_results
        }
    }


@router.delete("/settings/api/{exchange}")
async def delete_api_settings(exchange: str):
    """刪除指定交易所的 API 設定（從 .env 檔案中清除）"""
    try:
        logger.info("api_settings_delete_requested", exchange=exchange)
        
        if exchange in ["bybit", "binance"]:
            # 清除 .env 檔案中的 API 設定
            success = env_manager.clear_api_keys(exchange)
            
            if not success:
                raise Exception(f"清除 {exchange} API 設定失敗")
            
            # 重新載入配置
            import os
            from dotenv import load_dotenv
            from pathlib import Path
            
            # 重新載入 .env 檔案
            env_path = Path(__file__).parent.parent.parent.parent / ".env"
            load_dotenv(env_path, override=True)
            
            # 直接更新環境變數
            os.environ['BYBIT_API_KEY'] = os.getenv('BYBIT_API_KEY', '')
            os.environ['BYBIT_SECRET'] = os.getenv('BYBIT_SECRET', '')
            os.environ['BINANCE_API_KEY'] = os.getenv('BINANCE_API_KEY', '')
            os.environ['BINANCE_SECRET'] = os.getenv('BINANCE_SECRET', '')
            
            # 重新載入配置模組
            from ..config import EnvConfig
            import importlib
            import sys
            
            config_module = sys.modules['app.config']
            importlib.reload(config_module)
            
            # 更新全域配置
            global config
            config = config_module.config
            
            logger.info("api_settings_deleted", exchange=exchange)
            return {"success": True, "data": {"message": f"{exchange} API 設定已從 .env 檔案中刪除"}}
        else:
            raise HTTPException(
                status_code=404,
                detail={"code": "NOT_FOUND", "message": f"交易所 {exchange} 不存在"}
            )
            
    except Exception as e:
        logger.error("api_settings_delete_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"刪除 API 設定失敗: {str(e)}"}
        )
