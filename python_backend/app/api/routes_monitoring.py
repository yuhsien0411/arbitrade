from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, List, Dict, Any, Optional
import time
import uuid

from ..utils.logger import get_logger


router = APIRouter()
logger = get_logger()

# 記憶體儲存（後續可改為資料庫）
monitoring_pairs: Dict[str, Dict[str, Any]] = {}


class Leg(BaseModel):
    exchange: Literal["bybit", "binance"]
    symbol: str
    type: Literal["spot", "linear", "futures"]


class PairConfig(BaseModel):
    leg1: Leg
    leg2: Leg
    threshold: float = Field(gt=0, description="價差閾值")
    qty: float = Field(gt=0, description="交易數量")
    totalAmount: float = Field(gt=0, description="總金額")
    direction: Literal["auto", "buy_first", "sell_first"] = "auto"
    enabled: bool = True


class CreatePairRequest(BaseModel):
    leg1: Leg
    leg2: Leg
    threshold: float = Field(gt=0)
    qty: float = Field(gt=0)
    totalAmount: float = Field(gt=0)
    direction: Literal["auto", "buy_first", "sell_first"] = "auto"
    enabled: bool = True


class UpdatePairRequest(BaseModel):
    threshold: Optional[float] = Field(None, gt=0)
    qty: Optional[float] = Field(None, gt=0)
    totalAmount: Optional[float] = Field(None, gt=0)
    direction: Optional[Literal["auto", "buy_first", "sell_first"]] = None
    enabled: Optional[bool] = None


def _generate_pair_id(leg1: Leg, leg2: Leg) -> str:
    """生成交易對ID"""
    return f"{leg1.exchange}_{leg2.exchange}_{leg1.symbol.lower()}"


@router.get("/monitoring/pairs")
async def get_monitoring_pairs():
    """取得所有監控交易對"""
    pairs = []
    for pair_id, config in monitoring_pairs.items():
        pairs.append({
            "id": pair_id,
            **config
        })
    
    return {"success": True, "data": pairs}


@router.post("/monitoring/pairs")
async def create_monitoring_pair(request: CreatePairRequest):
    """新增監控交易對"""
    pair_id = _generate_pair_id(request.leg1, request.leg2)
    
    if pair_id in monitoring_pairs:
        raise HTTPException(
            status_code=409,
            detail={"code": "CONFLICT", "message": "Pair already exists"}
        )
    
    config = {
        "leg1": request.leg1.dict(),
        "leg2": request.leg2.dict(),
        "threshold": request.threshold,
        "qty": request.qty,
        "totalAmount": request.totalAmount,
        "direction": request.direction,
        "enabled": request.enabled
    }
    
    monitoring_pairs[pair_id] = config
    
    logger.info("pair_created", pairId=pair_id, success=True)
    
    return {"success": True, "data": {"id": pair_id}}


@router.put("/monitoring/pairs/{pair_id}")
async def update_monitoring_pair(pair_id: str, request: UpdatePairRequest):
    """更新監控交易對"""
    if pair_id not in monitoring_pairs:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Pair not found"}
        )
    
    config = monitoring_pairs[pair_id]
    
    # 更新非空欄位
    if request.threshold is not None:
        config["threshold"] = request.threshold
    if request.qty is not None:
        config["qty"] = request.qty
    if request.totalAmount is not None:
        config["totalAmount"] = request.totalAmount
    if request.direction is not None:
        config["direction"] = request.direction
    if request.enabled is not None:
        config["enabled"] = request.enabled
    
    logger.info("pair_updated", pairId=pair_id, success=True)
    
    return {"success": True}


@router.delete("/monitoring/pairs/{pair_id}")
async def delete_monitoring_pair(pair_id: str):
    """刪除監控交易對"""
    if pair_id not in monitoring_pairs:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Pair not found"}
        )
    
    del monitoring_pairs[pair_id]
    
    logger.info("pair_deleted", pairId=pair_id, success=True)
    
    return {"success": True}
