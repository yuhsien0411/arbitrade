"""
環境變數配置模組
處理 .env 檔案載入和環境變數管理
"""

import os
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path

# 載入 .env 檔案
env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(env_path)

class EnvConfig:
    """環境變數配置類別"""
    
    @property
    def DEBUG(self) -> bool:
        return os.getenv("DEBUG", "false").lower() == "true"
    
    @property
    def LOG_LEVEL(self) -> str:
        return os.getenv("LOG_LEVEL", "INFO")
    
    @property
    def BYBIT_API_KEY(self) -> Optional[str]:
        return os.getenv("BYBIT_API_KEY")
    
    @property
    def BYBIT_SECRET(self) -> Optional[str]:
        return os.getenv("BYBIT_SECRET")
    
    @property
    def BINANCE_API_KEY(self) -> Optional[str]:
        return os.getenv("BINANCE_API_KEY")
    
    @property
    def BINANCE_SECRET(self) -> Optional[str]:
        return os.getenv("BINANCE_SECRET")
    
    def get_exchange_config(self, exchange: str) -> dict:
        """取得指定交易所的 API 設定"""
        if exchange.lower() == "bybit":
            return {
                "apiKey": self.BYBIT_API_KEY or "",
                "secret": self.BYBIT_SECRET or "",
                "connected": bool(self.BYBIT_API_KEY and self.BYBIT_SECRET),
                "publicOnly": not bool(self.BYBIT_API_KEY and self.BYBIT_SECRET)
            }
        elif exchange.lower() == "binance":
            return {
                "apiKey": self.BINANCE_API_KEY or "",
                "secret": self.BINANCE_SECRET or "",
                "connected": bool(self.BINANCE_API_KEY and self.BINANCE_SECRET),
                "publicOnly": not bool(self.BINANCE_API_KEY and self.BINANCE_SECRET)
            }
        else:
            return {
                "apiKey": "",
                "secret": "",
                "connected": False,
                "publicOnly": True
            }
    
    def get_all_exchanges_config(self) -> dict:
        """取得所有交易所的 API 設定"""
        return {
            "bybit": self.get_exchange_config("bybit"),
            "binance": self.get_exchange_config("binance")
        }
    
    def validate_api_keys(self) -> dict:
        """驗證 API 金鑰格式"""
        errors = []
        warnings = []
        
        # 檢查 Bybit API 金鑰
        if self.BYBIT_API_KEY:
            if len(self.BYBIT_API_KEY) < 10:
                errors.append("BYBIT_API_KEY 格式不正確（長度不足）")
            if not self.BYBIT_SECRET:
                errors.append("BYBIT_SECRET 缺失")
            elif len(self.BYBIT_SECRET) < 10:
                errors.append("BYBIT_SECRET 格式不正確（長度不足）")
        elif self.BYBIT_SECRET:
            errors.append("BYBIT_API_KEY 缺失")
        
        # 檢查 Binance API 金鑰
        if self.BINANCE_API_KEY:
            if len(self.BINANCE_API_KEY) < 10:
                errors.append("BINANCE_API_KEY 格式不正確（長度不足）")
            if not self.BINANCE_SECRET:
                errors.append("BINANCE_SECRET 缺失")
            elif len(self.BINANCE_SECRET) < 10:
                errors.append("BINANCE_SECRET 格式不正確（長度不足）")
        elif self.BINANCE_SECRET:
            errors.append("BINANCE_API_KEY 缺失")
        
        # 檢查是否至少配置了一個交易所
        if not (self.BYBIT_API_KEY and self.BYBIT_SECRET) and not (self.BINANCE_API_KEY and self.BINANCE_SECRET):
            warnings.append("未配置任何交易所 API 金鑰，將只能使用公開數據")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "bybit_configured": bool(self.BYBIT_API_KEY and self.BYBIT_SECRET),
            "binance_configured": bool(self.BINANCE_API_KEY and self.BINANCE_SECRET)
        }
    
    def is_configured(self) -> bool:
        """檢查是否有任何交易所已配置 API 金鑰"""
        bybit_configured = bool(self.BYBIT_API_KEY and self.BYBIT_SECRET)
        binance_configured = bool(self.BINANCE_API_KEY and self.BINANCE_SECRET)
        return bybit_configured or binance_configured

# 創建全域配置實例
config = EnvConfig()
