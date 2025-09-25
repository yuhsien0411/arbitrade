from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional

from app.services.arbitrage_engine import arb_engine
from app.services.twap_engine import twap_engine
from app.api.routes_monitoring import clear_monitoring_data
from app.api.routes_monitoring import monitoring_pairs
from app.services.arbitrage_engine import PairConfig, Leg
from app.utils.logger import get_logger


router = APIRouter()
logger = get_logger()


class EngineControlRequest(BaseModel):
    action: Literal["start", "stop"]


class UpsertPairRequest(BaseModel):
    pairId: str
    leg1: Leg
    leg2: Leg
    threshold: float  # 允許負值
    qty: float = Field(gt=0)
    totalAmount: float = Field(gt=0)  # 總金額
    enabled: bool = True
    depth: Optional[int] = Field(default=1, ge=1)
    maxExecs: Optional[int] = Field(default=1, ge=1)


@router.get("/arbitrage/engine/status")
async def get_engine_status():
    return {"success": True, "data": arb_engine.get_status()}


@router.get("/arbitrage/pairs")
async def get_arbitrage_pairs():
    """取得所有套利監控對"""
    try:
        pairs = []
        for pair_id, config in arb_engine._pairs.items():
            # 從監控對統計帶出觸發資料，避免前端顯示為 0
            mp = monitoring_pairs.get(pair_id, {})
            total_triggers = mp.get('totalTriggers', 0)
            last_triggered = mp.get('lastTriggered', None)
            pair_data = {
                "id": pair_id,
                "leg1": {
                    "exchange": config.leg1.exchange,
                    "symbol": config.leg1.symbol,
                    "type": config.leg1.type,
                    "side": config.leg1.side
                },
                "leg2": {
                    "exchange": config.leg2.exchange,
                    "symbol": config.leg2.symbol,
                    "type": config.leg2.type,
                    "side": config.leg2.side
                },
                "threshold": config.threshold,
                "qty": config.qty,
                "enabled": config.enabled,
                "maxExecs": config.max_execs,
                "executionsCount": arb_engine._executions_count.get(pair_id, 0),
                "totalTriggers": total_triggers,
                "lastTriggered": last_triggered,
            }
            pairs.append(pair_data)
        return {"success": True, "data": pairs}
    except Exception as e:
        logger.error("arb_pairs_fetch_failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.get("/arbitrage/executions")
async def get_executions_history():
    try:
        return {"success": True, "data": arb_engine.get_executions_history()}
    except Exception as e:
        logger.error("arb_executions_fetch_failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.post("/arbitrage/engine/control")
async def control_engine(req: EngineControlRequest):
    try:
        if req.action == "start":
            await arb_engine.start()
        elif req.action == "stop":
            await arb_engine.stop()
        else:
            raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "invalid action"})
        logger.info("arb_engine_control", action=req.action, success=True)
        return {"success": True}
    except Exception as e:
        logger.error("arb_engine_control_failed", action=req.action, error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.post("/arbitrage/pairs")
async def upsert_pair(req: UpsertPairRequest):
    try:
        cfg = PairConfig(
            leg1=req.leg1,
            leg2=req.leg2,
            threshold=req.threshold,
            qty=req.qty,
            totalAmount=req.totalAmount,
            enabled=req.enabled,
            max_execs=req.maxExecs or 1,
        )
        arb_engine.upsert_pair(req.pairId, cfg)
        # 若引擎尚未啟動，嘗試自動啟動，避免未初始化導致不觸發
        status = arb_engine.get_status()
        if not status.get("running", False):
            try:
                await arb_engine.start()
                logger.info("arb_engine_autostart_after_upsert", pairId=req.pairId, success=True)
            except Exception as e:
                logger.error("arb_engine_autostart_failed", pairId=req.pairId, error=str(e))
        
        # 返回完整的交易對數據供前端使用（包含觸發統計）
        mp = monitoring_pairs.get(req.pairId, {})
        total_triggers = mp.get('totalTriggers', 0)
        last_triggered = mp.get('lastTriggered', None)
        pair_data = {
            "id": req.pairId,
            "leg1": {
                "exchange": cfg.leg1.exchange,
                "symbol": cfg.leg1.symbol,
                "type": cfg.leg1.type,
                "side": cfg.leg1.side
            },
            "leg2": {
                "exchange": cfg.leg2.exchange,
                "symbol": cfg.leg2.symbol,
                "type": cfg.leg2.type,
                "side": cfg.leg2.side
            },
            "threshold": cfg.threshold,
            "qty": cfg.qty,
            "enabled": cfg.enabled,
            "maxExecs": cfg.max_execs,
            "executionsCount": arb_engine._executions_count.get(req.pairId, 0),
            "createdAt": int(time.time() * 1000),
            "lastTriggered": last_triggered,
            "totalTriggers": total_triggers,
        }
        
        return {"success": True, "data": pair_data}
    except Exception as e:
        logger.error("arb_pair_upsert_failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.delete("/arbitrage/pairs/{pair_id}")
async def remove_pair(pair_id: str):
    try:
        arb_engine.remove_pair(pair_id)
        return {"success": True}
    except Exception as e:
        logger.error("arb_pair_remove_failed", pairId=pair_id, error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


class UpdatePairRequest(BaseModel):
    enabled: Optional[bool] = None
    threshold: Optional[float] = None
    qty: Optional[float] = Field(None, gt=0)
    maxExecs: Optional[int] = Field(None, ge=1)


@router.put("/arbitrage/pairs/{pair_id}")
async def update_pair(pair_id: str, req: UpdatePairRequest):
    try:
        cfg = arb_engine._pairs.get(pair_id)
        if not cfg:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "pair not found"})
        # 局部更新
        if req.enabled is not None:
            cfg.enabled = bool(req.enabled)
        if req.threshold is not None:
            cfg.threshold = float(req.threshold)
        if req.qty is not None:
            cfg.qty = float(req.qty)
        if req.maxExecs is not None and req.maxExecs >= 1:
            cfg.max_execs = int(req.maxExecs)
        arb_engine._pairs[pair_id] = cfg
        logger.info("arb_pair_updated", pairId=pair_id, enabled=cfg.enabled)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("arb_pair_update_failed", pairId=pair_id, error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.post("/arbitrage/refresh-prices")
async def refresh_all_prices():
    """刷新所有監控對的價格數據"""
    try:
        refreshed_count = 0
        for pair_id, config in arb_engine._pairs.items():
            if config.enabled:
                await arb_engine._refresh_pair_prices(pair_id, config)
                refreshed_count += 1
        
        logger.info("arb_prices_refresh_all", count=refreshed_count, success=True)
        return {"success": True, "message": f"已刷新 {refreshed_count} 個監控對的價格數據"}
    except Exception as e:
        logger.error("arb_prices_refresh_all_failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.post("/arbitrage/pairs/{pair_id}/refresh-prices")
async def refresh_pair_prices(pair_id: str):
    """刷新指定監控對的價格數據"""
    try:
        config = arb_engine._pairs.get(pair_id)
        if not config:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "監控對不存在"})
        
        await arb_engine._refresh_pair_prices(pair_id, config)
        
        logger.info("arb_prices_refresh_pair", pairId=pair_id, success=True)
        return {"success": True, "message": f"已刷新監控對 {pair_id} 的價格數據"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("arb_prices_refresh_pair_failed", pairId=pair_id, error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.post("/arbitrage/clear-all-data")
async def clear_all_data():
    """清空所有後端資料"""
    try:
        # 清空套利引擎資料
        arb_engine.clear_all_data()
        
        # 清空 TWAP 引擎資料
        twap_engine.clear_all_data()
        
        # 清空監控對資料
        clear_monitoring_data()
        
        logger.info("all_backend_data_cleared", success=True)
        return {"success": True, "message": "所有後端資料已清空"}
    except Exception as e:
        logger.error("clear_all_data_failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


