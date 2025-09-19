from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, List, Dict, Any
import time

from ..utils.http import get_http_client
from ..services.cache_manager import TTLCache


router = APIRouter()
cache = TTLCache(default_ttl_seconds=1.0)


ExchangeName = Literal["bybit", "binance"]


class BatchItem(BaseModel):
    exchange: ExchangeName
    symbol: str


class BatchRequest(BaseModel):
    items: List[BatchItem] = Field(default_factory=list)


async def _fetch_orderbook(exchange: ExchangeName, symbol: str, category: str = None) -> Dict[str, Any]:
    # 如果有指定category，優先使用指定的category
    categories = [category] if category else ["spot", "linear"]
    cache_key = f"orderbook:{exchange}:{symbol}:{category or 'auto'}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    client = await get_http_client()
    if exchange == "bybit":
        # 先用 tickers 取 bid1/ask1，失敗再回退 orderbook
        payload = None
        for cat in categories:
            tickers_url = f"https://api.bybit.com/v5/market/tickers?category={cat}&symbol={symbol}"
            r = await client.get(tickers_url)
            if r.status_code == 200:
                data = r.json()
                if data.get("retCode") == 0:
                    list_data = data.get("result", {}).get("list", [])
                    if list_data:
                        t = list_data[0]
                        bid = t.get("bid1Price")
                        bid_size = t.get("bid1Size", "0")
                        ask = t.get("ask1Price")
                        ask_size = t.get("ask1Size", "0")
                        ts = int(t.get("ts", int(time.time() * 1000)))
                        if bid and ask:
                            payload = {
                                "exchange": exchange,
                                "symbol": symbol,
                                "bids": [[bid, bid_size]],
                                "asks": [[ask, ask_size]],
                                "ts": ts,
                            }
                            break
            # 回退到 orderbook depth=1
            ob_url = f"https://api.bybit.com/v5/market/orderbook?category={cat}&symbol={symbol}&limit=1"
            r = await client.get(ob_url)
            if r.status_code == 200:
                data = r.json()
                if data.get("retCode") == 0:
                    list_data = data.get("result", {}).get("list", [])
                    if list_data:
                        ob = list_data[0]
                        bids = ob.get("b", [])
                        asks = ob.get("a", [])
                        ts = int(ob.get("ts", int(time.time() * 1000)))
                        payload = {
                            "exchange": exchange,
                            "symbol": symbol,
                            "bids": bids,
                            "asks": asks,
                            "ts": ts,
                        }
                        break
        if payload is None:
            raise HTTPException(status_code=502, detail={"code": "UPSTREAM_ERROR", "message": "bybit unavailable"})
    elif exchange == "binance":
        url = f"https://api.binance.com/api/v3/depth?symbol={symbol}&limit=5"
        r = await client.get(url)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail={"code": "UPSTREAM_ERROR", "message": "binance error"})
        data = r.json()
        bids = data.get("bids", [])
        asks = data.get("asks", [])
        ts = int(time.time() * 1000)
        payload = {
            "exchange": exchange,
            "symbol": symbol,
            "bids": bids,
            "asks": asks,
            "ts": ts,
        }
    else:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "unsupported exchange"})

    await cache.set(cache_key, payload, ttl_seconds=1.0)
    return payload


@router.get("/prices/{exchange}/{symbol}")
async def get_price(exchange: ExchangeName, symbol: str, category: str = None):
    data = await _fetch_orderbook(exchange, symbol, category)
    return {"success": True, "data": data}


@router.post("/prices/batch")
async def get_prices_batch(req: BatchRequest):
    results: List[Dict[str, Any]] = []
    for item in req.items:
        data = await _fetch_orderbook(item.exchange, item.symbol)
        results.append(data)
    return {"success": True, "data": results}


