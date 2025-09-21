from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Dict, Optional, Any

from app.utils.logger import get_logger
import json
try:
    # 用於即時推播到前端
    from app.main import manager as ws_manager
except Exception:
    ws_manager = None  # 避免導入循環在測試時出錯
from app.api.routes_prices import _fetch_orderbook  # fallback HTTP 拉取
from app.services.orderbook_feed import bybit_orderbook_feed
from app.config.env import config


@dataclass
class Leg:
    exchange: str
    symbol: str
    type: str  # 'spot' | 'linear' | 'future'（此版本僅用於標示）
    side: str  # 'buy' | 'sell'


@dataclass
class PairConfig:
    leg1: Leg
    leg2: Leg
    threshold: float  # 百分比門檻，例如 0.02 代表 0.02%
    qty: float
    totalAmount: float  # 總金額 = qty * max_execs
    enabled: bool = True
    max_execs: int = 1  # 每次配置允許觸發的最大次數


class ArbitrageEngine:
    """簡化版套利引擎：維護監控對、輪詢行情、達閾值時觸發執行（此版本先記錄 log）。"""

    def __init__(self) -> None:
        self.logger = get_logger()
        self._pairs: Dict[str, PairConfig] = {}
        self._task: Optional[asyncio.Task] = None
        self._running: bool = False
        self._interval_sec: float = 0.25
        self._executions_count: Dict[str, int] = {}
        self._executing_pairs: set[str] = set()
        self._executions_history: Dict[str, list] = {}

    # -------- 外部介面 --------
    def get_status(self) -> Dict[str, Any]:
        return {
            "running": self._running,
            "pairs": list(self._pairs.keys()),
            "intervalSec": self._interval_sec,
        }

    async def start(self) -> bool:
        if self._running:
            return True
        
        # 自動載入監控對
        await self._load_monitoring_pairs()
        
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        self.logger.info("arb_engine_started", success=True, pairsCount=len(self._pairs))
        return True

    async def stop(self) -> bool:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self.logger.info("arb_engine_stopped", success=True)
        return True

    def clear_all_data(self) -> None:
        """清空所有套利引擎資料"""
        self._pairs.clear()
        self._executions_count.clear()
        self._executing_pairs.clear()
        self._executions_history.clear()
        self.logger.info("arb_engine_data_cleared", success=True)

    def upsert_pair(self, pair_id: str, config: PairConfig) -> None:
        self._pairs[pair_id] = config
        self.logger.info("arb_pair_upserted", pairId=pair_id, enabled=config.enabled)
        # 重置統計（重新配置視為新的執行配額）
        self._executions_count[pair_id] = 0
        # 預訂閱 bybit WS（若為 bybit）
        try:
            if config.leg1.exchange == "bybit":
                bybit_orderbook_feed.subscribe(
                    category="linear" if config.leg1.type in ("linear", "future", "futures") else "spot",
                    symbol=config.leg1.symbol,
                    depth=1,
                )
            if config.leg2.exchange == "bybit":
                bybit_orderbook_feed.subscribe(
                    category="linear" if config.leg2.type in ("linear", "future", "futures") else "spot",
                    symbol=config.leg2.symbol,
                    depth=1,
                )
        except Exception as e:
            self.logger.error("arb_pair_pre_subscribe_error", pairId=pair_id, error=str(e))

    def remove_pair(self, pair_id: str) -> None:
        if pair_id in self._pairs:
            del self._pairs[pair_id]
            self.logger.info("arb_pair_removed", pairId=pair_id)
        # 清理執行鎖與計數
        self._executions_count.pop(pair_id, None)
        if pair_id in self._executing_pairs:
            self._executing_pairs.discard(pair_id)

    async def _load_monitoring_pairs(self) -> None:
        """從監控對系統載入所有啟用的交易對"""
        try:
            # 避免循環導入，直接從模組獲取
            import app.api.routes_monitoring as routes_monitoring
            monitoring_pairs = routes_monitoring.monitoring_pairs
            
            loaded_count = 0
            for pair_id, config in monitoring_pairs.items():
                if config.get("enabled", True):  # 只載入啟用的對
                    try:
                        # 轉換為 PairConfig，使用配置中的side或預設值
                        leg1 = Leg(
                            exchange=config["leg1"]["exchange"],
                            symbol=config["leg1"]["symbol"],
                            type=config["leg1"]["type"],
                            side=config["leg1"].get("side", "buy")  # 使用配置的side或預設為買入
                        )
                        leg2 = Leg(
                            exchange=config["leg2"]["exchange"],
                            symbol=config["leg2"]["symbol"],
                            type=config["leg2"]["type"],
                            side=config["leg2"].get("side", "sell")  # 使用配置的side或預設為賣出
                        )
                        
                        pair_config = PairConfig(
                            leg1=leg1,
                            leg2=leg2,
                            threshold=config["threshold"],
                            qty=config["qty"],
                            enabled=config.get("enabled", True),
                            max_execs=config.get("maxExecs", 1)
                        )
                        
                        self._pairs[pair_id] = pair_config
                        loaded_count += 1
                        
                        # 預訂閱 WebSocket
                        self._subscribe_pair(pair_config)
                        
                    except Exception as e:
                        self.logger.error("arb_load_pair_failed", pairId=pair_id, error=str(e))
            
            self.logger.info("arb_pairs_loaded", count=loaded_count, total=len(monitoring_pairs))
            
        except Exception as e:
            self.logger.error("arb_load_monitoring_pairs_failed", error=str(e))

    def _subscribe_pair(self, config: PairConfig) -> None:
        """為交易對訂閱 WebSocket"""
        try:
            if config.leg1.exchange == "bybit":
                bybit_orderbook_feed.subscribe(
                    category="linear" if config.leg1.type in ("linear", "future", "futures") else "spot",
                    symbol=config.leg1.symbol,
                    depth=1,
                )
            if config.leg2.exchange == "bybit":
                bybit_orderbook_feed.subscribe(
                    category="linear" if config.leg2.type in ("linear", "future", "futures") else "spot",
                    symbol=config.leg2.symbol,
                    depth=1,
                )
        except Exception as e:
            self.logger.error("arb_pair_subscribe_error", error=str(e))

    # -------- 內部邏輯 --------
    async def _run_loop(self) -> None:
        try:
            while self._running:
                started = time.time()
                await self._tick()
                elapsed = time.time() - started
                await asyncio.sleep(max(0.0, self._interval_sec - elapsed))
        except asyncio.CancelledError:
            self.logger.info("arb_engine_loop_cancelled")
        except Exception as e:
            self.logger.error("arb_engine_loop_error", error=str(e))
            self._running = False

    async def _tick(self) -> None:
        if not self._pairs:
            return
        for pair_id, cfg in list(self._pairs.items()):
            if not cfg.enabled:
                continue
            try:
                # 先嘗試使用 WS 頂檔（只 1 檔 snapshot），暫無則回退 HTTP 拉取
                leg1_bid = leg1_ask = 0.0
                leg2_bid = leg2_ask = 0.0

                if cfg.leg1.exchange == "bybit":
                    # 訂閱已移至 upsert 時，避免在循環內重複訂閱
                    b, a = bybit_orderbook_feed.get_top_of_book(
                        category="linear" if cfg.leg1.type in ("linear", "future", "futures") else "spot",
                        symbol=cfg.leg1.symbol,
                        depth=1,
                    )
                    leg1_bid = b or 0.0
                    leg1_ask = a or 0.0

                if cfg.leg2.exchange == "bybit":
                    # 訂閱已移至 upsert 時
                    b, a = bybit_orderbook_feed.get_top_of_book(
                        category="linear" if cfg.leg2.type in ("linear", "future", "futures") else "spot",
                        symbol=cfg.leg2.symbol,
                        depth=1,
                    )
                    leg2_bid = b or 0.0
                    leg2_ask = a or 0.0

                # 若 WS 暫無資料，回退 HTTP
                if leg1_bid == 0.0 and leg1_ask == 0.0:
                    leg1_book = await _fetch_orderbook(cfg.leg1.exchange, cfg.leg1.symbol)
                    leg1_bid = float(leg1_book.get("bids", [[0]])[0][0]) if leg1_book.get("bids") else 0.0
                    leg1_ask = float(leg1_book.get("asks", [[0]])[0][0]) if leg1_book.get("asks") else 0.0
                if leg2_bid == 0.0 and leg2_ask == 0.0:
                    leg2_book = await _fetch_orderbook(cfg.leg2.exchange, cfg.leg2.symbol)
                    leg2_bid = float(leg2_book.get("bids", [[0]])[0][0]) if leg2_book.get("bids") else 0.0
                    leg2_ask = float(leg2_book.get("asks", [[0]])[0][0]) if leg2_book.get("asks") else 0.0

                # 以「買用 ASK、賣用 BID」的邏輯計算
                leg1_exec = leg1_ask if cfg.leg1.side == "buy" else leg1_bid
                leg2_exec = leg2_ask if cfg.leg2.side == "buy" else leg2_bid

                if leg1_exec <= 0 or leg2_exec <= 0:
                    continue

                # 你指定的基準：spreadPct = (BID - ASK) / ASK * 100
                # 假設 leg1 為買、leg2 為賣時：使用 (sell_bid - buy_ask)/buy_ask
                # 通用化：以第一腿作為買入腿基準
                base = leg1_exec
                spread = leg2_exec - leg1_exec
                spread_pct = (spread / base) * 100.0

                # 只在觸發時才記錄日誌，避免過多輸出
                # 低頻詳情日誌（僅在有價差且有價時輸出，可協助診斷觸發門檻）
                if spread_pct != 0 and (int(time.time()) % 3 == 0):
                    self.logger.info(
                        "arb_tick_brief",
                        pairId=pair_id,
                        leg1Exec=leg1_exec,
                        leg2Exec=leg2_exec,
                        spread=spread,
                        spreadPct=spread_pct,
                        threshold=cfg.threshold,
                    )

                # 透過 WS 推送即時價格，減少前端等待
                try:
                    if ws_manager is not None:
                        payload = json.dumps({
                            "type": "priceUpdate",
                            "data": {
                                "id": pair_id,
                                "pairConfig": {
                                    "id": pair_id,
                                    "leg1": {"exchange": cfg.leg1.exchange, "symbol": cfg.leg1.symbol, "type": cfg.leg1.type, "side": cfg.leg1.side},
                                    "leg2": {"exchange": cfg.leg2.exchange, "symbol": cfg.leg2.symbol, "type": cfg.leg2.type, "side": cfg.leg2.side},
                                    "threshold": cfg.threshold
                                },
                                "leg1Price": {"symbol": cfg.leg1.symbol, "exchange": cfg.leg1.exchange, "bid1": {"price": leg1_bid}, "ask1": {"price": leg1_ask}},
                                "leg2Price": {"symbol": cfg.leg2.symbol, "exchange": cfg.leg2.exchange, "bid1": {"price": leg2_bid}, "ask1": {"price": leg2_ask}},
                                "spread": spread,
                                "spreadPercent": spread_pct,
                                "threshold": cfg.threshold,
                                "timestamp": int(time.time() * 1000)
                            }
                        })
                        import asyncio
                        asyncio.create_task(ws_manager.broadcast(payload))
                except Exception:
                    pass

                # 觸發邏輯：統一使用 spread >= threshold
                # - threshold = 0.0 → 任何正價差都會觸發
                # - threshold > 0 → 價差 >= 閾值時觸發
                # - threshold < 0 → 價差 >= 負閾值時觸發（負向套利）
                should_trigger = (spread_pct >= cfg.threshold)
                # 執行次數與冷卻/鎖檢查
                if self._executions_count.get(pair_id, 0) >= getattr(cfg, "max_execs", 1):
                    should_trigger = False
                if pair_id in self._executing_pairs:
                    should_trigger = False
                if should_trigger:
                    # 自動執行套利交易
                    self.logger.info(
                        "arb_auto_execute_triggered",
                        pairId=pair_id,
                        threshold=cfg.threshold,
                        spreadPct=spread_pct,
                        qty=cfg.qty,
                    )
                    
                    # 執行自動套利
                    await self._execute_arbitrage(pair_id, cfg, leg1_exec, leg2_exec)
            except Exception as e:
                self.logger.error("arb_tick_error", pairId=pair_id, error=str(e))

    async def _execute_arbitrage(self, pair_id: str, config: PairConfig, leg1_exec: float, leg2_exec: float) -> None:
        """執行自動套利交易"""
        try:
            from .twap_engine import OrderResult
            
            # 記錄開始執行
            self.logger.info("arb_execute_start", pairId=pair_id, leg1Exec=leg1_exec, leg2Exec=leg2_exec)
            # 標記執行鎖，避免並發
            self._executing_pairs.add(pair_id)
            
            # 執行 Leg1 訂單
            leg1_result = await self._place_order(config.leg1, config.qty)
            if not leg1_result.success:
                self.logger.error("arb_leg1_failed", pairId=pair_id, error=leg1_result.error_message)
                return
                
            # 執行 Leg2 訂單
            leg2_result = await self._place_order(config.leg2, config.qty)
            if not leg2_result.success:
                # Leg2 失敗，回滾 Leg1
                self.logger.warning("arb_leg2_failed_rollback", pairId=pair_id, leg1OrderId=leg1_result.order_id)
                await self._rollback_order(config.leg1, config.qty, leg1_result.order_id)
                return
                
            # 兩腿都成功
            self.logger.info("arb_execute_success", 
                           pairId=pair_id, 
                           leg1OrderId=leg1_result.order_id,
                           leg2OrderId=leg2_result.order_id,
                           leg1Price=leg1_result.price,
                           leg2Price=leg2_result.price)
            # 增加次數
            self._executions_count[pair_id] = self._executions_count.get(pair_id, 0) + 1

            # 記錄到執行歷史
            history = self._executions_history.setdefault(pair_id, [])
            history.append({
                "ts": int(time.time() * 1000),
                "pairId": pair_id,
                "qty": config.qty,
                "leg1": {
                    "exchange": config.leg1.exchange,
                    "symbol": config.leg1.symbol,
                    "type": config.leg1.type,
                    "side": config.leg1.side,
                    "orderId": leg1_result.order_id,
                },
                "leg2": {
                    "exchange": config.leg2.exchange,
                    "symbol": config.leg2.symbol,
                    "type": config.leg2.type,
                    "side": config.leg2.side,
                    "orderId": leg2_result.order_id,
                }
            })

            # WebSocket 推播：即時通知前端顯示執行結果
            try:
                if ws_manager is not None:
                    payload = json.dumps({
                        "type": "arbitrageExecuted",
                        "data": {
                            "pairId": pair_id,
                            "leg1OrderId": leg1_result.order_id,
                            "leg2OrderId": leg2_result.order_id,
                            "qty": config.qty,
                            "ts": int(time.time() * 1000),
                            "leg1": {
                                "exchange": config.leg1.exchange,
                                "symbol": config.leg1.symbol,
                                "type": config.leg1.type,
                                "side": config.leg1.side,
                            },
                            "leg2": {
                                "exchange": config.leg2.exchange,
                                "symbol": config.leg2.symbol,
                                "type": config.leg2.type,
                                "side": config.leg2.side,
                            }
                        }
                    })
                    import asyncio
                    asyncio.create_task(ws_manager.broadcast(payload))
            except Exception:
                pass

            # 若達到最大執行次數：移除該進程（監控對）
            if self._executions_count[pair_id] >= getattr(config, "max_execs", 1):
                self.logger.info("arb_pair_completed_removed", pairId=pair_id, executions=self._executions_count[pair_id])
                self.remove_pair(pair_id)
                # 推播移除事件，讓前端即時更新
                try:
                    if ws_manager is not None:
                        payload = json.dumps({
                            "type": "pairRemoved",
                            "data": {"id": pair_id}
                        })
                        import asyncio
                        asyncio.create_task(ws_manager.broadcast(payload))
                except Exception:
                    pass
                           
        except Exception as e:
            self.logger.error("arb_execute_error", pairId=pair_id, error=str(e))
        finally:
            # 釋放執行鎖
            if pair_id in self._executing_pairs:
                self._executing_pairs.discard(pair_id)

    # 供 API 讀取執行歷史
    def get_executions_history(self) -> Dict[str, list]:
        return self._executions_history

    async def _place_order(self, leg: Leg, qty: float):
        """下單（現貨或合約）"""
        try:
            from .twap_engine import OrderResult
            from pybit.unified_trading import HTTP

            # 檢查 API 密鑰是否配置
            if not config.BYBIT_API_KEY or not config.BYBIT_SECRET:
                self.logger.warning("arb_api_keys_not_configured", 
                                 message="Bybit API 密鑰未配置，無法執行實際交易")
                return OrderResult(
                    success=False,
                    price=None,
                    order_id=None,
                    error_message="API 密鑰未配置"
                )

            # 與 TWAP 引擎對齊：使用主網設定，避免雙腿落在不同網路
            client = HTTP(
                testnet=False,
                api_key=config.BYBIT_API_KEY,
                api_secret=config.BYBIT_SECRET,
            )

            side = "Buy" if leg.side == "buy" else "Sell"
            quantity = str(qty)

            if leg.type in ("linear", "future", "futures"):
                # 合約下單（市價）
                response = client.place_order(
                    category="linear",
                    symbol=leg.symbol,
                    side=side,
                    orderType="Market",
                    qty=quantity,
                )
            else:
                # 現貨下單（Bybit 需要 marketUnit，若走槓桿現貨需 isLeverage）
                response = client.place_order(
                    category="spot",
                    symbol=leg.symbol,
                    side=side,
                    orderType="Market",
                    qty=quantity,
                    marketUnit="baseCoin",
                    isLeverage=1,
                )

            if response.get("retCode") == 0:
                order_id = response.get("result", {}).get("orderId")
                price = None  # 市價單沒有固定價格
                return OrderResult(success=True, price=price, order_id=order_id)
            else:
                error_msg = response.get("retMsg", "Unknown error")
                return OrderResult(success=False, price=None, order_id=None, error_message=error_msg)

        except Exception as e:
            return OrderResult(success=False, price=None, order_id=None, error_message=str(e))

    async def _rollback_order(self, leg: Leg, qty: float, original_order_id: str) -> None:
        """回滾訂單（執行反向操作）"""
        try:
            # 反向操作
            reverse_side = "sell" if leg.side == "buy" else "buy"
            reverse_leg = Leg(
                exchange=leg.exchange,
                symbol=leg.symbol,
                type=leg.type,
                side=reverse_side
            )
            
            rollback_result = await self._place_order(reverse_leg, qty)
            if rollback_result.success:
                self.logger.info("arb_rollback_success", 
                               originalOrderId=original_order_id,
                               rollbackOrderId=rollback_result.order_id)
            else:
                self.logger.error("arb_rollback_failed", 
                                originalOrderId=original_order_id,
                                error=rollback_result.error_message)
                                
        except Exception as e:
            self.logger.error("arb_rollback_error", originalOrderId=original_order_id, error=str(e))


# 全域引擎實例
arb_engine = ArbitrageEngine()


