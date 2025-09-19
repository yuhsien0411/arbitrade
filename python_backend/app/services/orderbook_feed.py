from __future__ import annotations

import asyncio
import threading
from typing import Dict, List, Tuple, Optional

from app.utils.logger import get_logger

try:
    from pybit.unified_trading import WebSocket
except Exception:  # 避免在未安裝時中斷導入
    WebSocket = None  # type: ignore


class OrderbookBook:
    """維護單一標的的本地 orderbook（僅儲存指定深度）。"""

    def __init__(self, depth: int) -> None:
        self.depth = depth
        self.bids: Dict[float, float] = {}
        self.asks: Dict[float, float] = {}
        self.u: Optional[int] = None

    def apply_snapshot(self, bids: List[List[str]], asks: List[List[str]], u: Optional[int]) -> None:
        self.bids.clear()
        self.asks.clear()
        for price_str, qty_str in bids:
            price = float(price_str)
            qty = float(qty_str)
            if qty > 0:
                self.bids[price] = qty
        for price_str, qty_str in asks:
            price = float(price_str)
            qty = float(qty_str)
            if qty > 0:
                self.asks[price] = qty
        self.u = u
        self._trim()

    def apply_delta(self, bids: List[List[str]], asks: List[List[str]], u: Optional[int]) -> None:
        for price_str, qty_str in bids:
            price = float(price_str)
            qty = float(qty_str)
            if qty <= 0:
                self.bids.pop(price, None)
            else:
                self.bids[price] = qty
        for price_str, qty_str in asks:
            price = float(price_str)
            qty = float(qty_str)
            if qty <= 0:
                self.asks.pop(price, None)
            else:
                self.asks[price] = qty
        self.u = u
        self._trim()

    def _trim(self) -> None:
        # 僅保留前 depth 檔
        if len(self.bids) > self.depth:
            for p in sorted(self.bids.keys(), reverse=True)[self.depth:]:
                self.bids.pop(p, None)
        if len(self.asks) > self.depth:
            for p in sorted(self.asks.keys())[: -(self.depth)]:
                # 此寫法保險，實際上僅保留前 depth
                pass
            for p in sorted(self.asks.keys())[self.depth:]:
                self.asks.pop(p, None)

    def best_bid_ask(self) -> Tuple[Optional[float], Optional[float]]:
        best_bid = max(self.bids.keys()) if self.bids else None
        best_ask = min(self.asks.keys()) if self.asks else None
        return best_bid, best_ask


class BybitOrderbookFeed:
    """Bybit 訂單簿 WS 訂閱器。支援 snapshot/delta，維護本地頂檔。"""

    def __init__(self, use_testnet: bool = True) -> None:
        self.logger = get_logger()
        self.use_testnet = use_testnet
        self.ws_linear: Optional[WebSocket] = None
        self.ws_spot: Optional[WebSocket] = None
        self._lock = threading.Lock()
        # key: (category, symbol, depth)
        self._books: Dict[Tuple[str, str, int], OrderbookBook] = {}
        self._loop = asyncio.get_event_loop()
        self._subscribed: set[Tuple[str, str, int]] = set()

    def _ensure_ws(self, category: str) -> None:
        if WebSocket is None:
            raise RuntimeError("pybit 未安裝，無法使用 WebSocket")
        if category == "linear" and self.ws_linear is None:
            self.ws_linear = WebSocket(testnet=self.use_testnet, channel_type="linear")
        if category == "spot" and self.ws_spot is None:
            self.ws_spot = WebSocket(testnet=self.use_testnet, channel_type="spot")

    def subscribe(self, category: str, symbol: str, depth: int = 1) -> None:
        """訂閱指定品種僅 1 檔，Bybit 1檔只會推 snapshot。"""
        depth = 1  # 強制 1 檔
        self._ensure_ws(category)
        key = (category, symbol, depth)
        with self._lock:
            if key not in self._books:
                self._books[key] = OrderbookBook(depth=depth)
            # 已訂閱則不重複
            if key in self._subscribed:
                return

        def handle_message(message: dict) -> None:
            try:
                if not isinstance(message, dict):
                    return
                topic = message.get("topic", "")
                mtype = message.get("type")  # snapshot | delta
                data = message.get("data") or {}
                if not topic.startswith("orderbook."):
                    return
                # topic: orderbook.{depth}.{symbol}
                parts = topic.split(".")
                if len(parts) < 3:
                    return
                t_depth = int(parts[1])
                t_symbol = parts[2]
                k = (category, t_symbol, t_depth)
                book = self._books.get(k)
                if not book:
                    return
                bids = data.get("b") or []
                asks = data.get("a") or []
                u = data.get("u")
                # 僅處理 snapshot（1 檔 Bybit 只推 snapshot；若偶發 delta，忽略）
                if mtype == "snapshot":
                    book.apply_snapshot(bids, asks, u)
                else:
                    return
            except Exception as e:
                self.logger.error("bybit_orderbook_handle_error", error=str(e))

        # 根據類別選擇對應 ws
        ws = self.ws_linear if category == "linear" else self.ws_spot
        assert ws is not None
        ws.orderbook_stream(depth=depth, symbol=symbol, callback=handle_message)
        with self._lock:
            self._subscribed.add(key)
        self.logger.info("bybit_orderbook_subscribed", category=category, symbol=symbol, depth=depth)

    def get_top_of_book(self, category: str, symbol: str, depth: int = 1) -> Tuple[Optional[float], Optional[float]]:
        key = (category, symbol, depth)
        with self._lock:
            book = self._books.get(key)
            if not book:
                return None, None
            return book.best_bid_ask()


# 全域單例
bybit_orderbook_feed = BybitOrderbookFeed(use_testnet=False)


