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

def clear_monitoring_data() -> None:
    """清空監控對資料"""
    monitoring_pairs.clear()
    logger.info("monitoring_data_cleared", success=True)


class Leg(BaseModel):
    exchange: Literal["bybit", "binance"]
    symbol: str
    type: Literal["spot", "linear", "futures"]
    side: Literal["buy", "sell"]


class PairConfig(BaseModel):
    leg1: Leg
    leg2: Leg
    threshold: float = Field(description="價差閾值，可為負數代表反向觸發")
    qty: float = Field(gt=0, description="交易數量")
    totalAmount: float = Field(gt=0, description="總金額")
    direction: Literal["auto", "buy_first", "sell_first"] = "auto"
    enabled: bool = True


class CreatePairRequest(BaseModel):
    leg1: Leg
    leg2: Leg
    threshold: float
    qty: float = Field(gt=0)
    totalAmount: float = Field(gt=0)
    direction: Literal["auto", "buy_first", "sell_first"] = "auto"
    enabled: bool = True


class UpdatePairRequest(BaseModel):
    threshold: Optional[float] = None
    qty: Optional[float] = Field(None, gt=0)
    totalAmount: Optional[float] = Field(None, gt=0)
    direction: Optional[Literal["auto", "buy_first", "sell_first"]] = None
    enabled: Optional[bool] = None


def _generate_pair_id(leg1: Leg, leg2: Leg) -> str:
    """生成交易對ID"""
    return f"{leg1.exchange}_{leg2.exchange}_{leg1.symbol.lower()}"


def _resolve_pair_id(pair_id: str) -> Optional[str]:
    """嘗試在現有列表中解析對應的 pair_id（忽略大小寫等差異）。"""
    if pair_id in monitoring_pairs:
        return pair_id
    # 常見情況：symbol 大小寫不同
    lowered = pair_id.rsplit('_', 1)
    if len(lowered) == 2:
        alt = f"{lowered[0]}_{lowered[1].lower()}"
        if alt in monitoring_pairs:
            return alt
    # 最後嘗試忽略大小寫比對
    for key in monitoring_pairs.keys():
        if key.lower() == pair_id.lower():
            return key
    return None


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
    """新增監控交易對（支援覆蓋現有）"""
    pair_id = _generate_pair_id(request.leg1, request.leg2)
    
    # 如果已存在，直接更新而不是報錯
    if pair_id in monitoring_pairs:
        logger.info("monitoring_pair_exists_updating", pairId=pair_id)
    
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
    resolved_id = _resolve_pair_id(pair_id)
    if not resolved_id:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Pair not found"}
        )
    
    config = monitoring_pairs[resolved_id]
    
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
    
    logger.info("pair_updated", pairId=resolved_id, success=True)
    
    return {"success": True}


@router.delete("/monitoring/pairs/{pair_id}")
async def delete_monitoring_pair(pair_id: str):
    """刪除監控交易對"""
    resolved_id = _resolve_pair_id(pair_id)
    if not resolved_id:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Pair not found"}
        )
    
    del monitoring_pairs[resolved_id]
    
    logger.info("pair_deleted", pairId=resolved_id, success=True)
    
    return {"success": True}
