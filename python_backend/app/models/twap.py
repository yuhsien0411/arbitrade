from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal, List, Dict, Any, Optional
from enum import Enum
import time
import uuid


class TwapState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class OrderTemplate(BaseModel):
    exchange: Literal["bybit", "binance"]
    symbol: str
    side: Literal["buy", "sell"]
    # 下單型別（市價/限價）
    type: Literal["market", "limit"] = "market"
    # 資產類別（現貨/合約）
    category: Literal["spot", "linear"] = "spot"
    price: Optional[float] = None  # 限價單使用


class TwapPlan(BaseModel):
    planId: str = Field(default_factory=lambda: f"twap_{uuid.uuid4().hex[:8]}")
    name: str
    totalQty: float = Field(gt=0, description="總數量")
    sliceQty: float = Field(gt=0, description="每片數量")
    intervalMs: int = Field(gt=0, description="間隔毫秒")
    legs: List[OrderTemplate] = Field(min_items=1, description="交易腿")
    createdAt: int = Field(default_factory=lambda: int(time.time() * 1000))
    state: TwapState = TwapState.PENDING


class TwapProgress(BaseModel):
    planId: str
    executed: float = Field(ge=0, description="已執行數量")
    remaining: float = Field(ge=0, description="剩餘數量")
    slicesDone: int = Field(ge=0, description="已完成片數")
    slicesTotal: int = Field(ge=0, description="總片數")
    state: TwapState
    lastExecutionTs: Optional[int] = None
    nextExecutionTs: Optional[int] = None


class TwapExecution(BaseModel):
    planId: str
    sliceIndex: int
    legIndex: int
    orderId: Optional[str] = None
    success: bool
    price: Optional[float] = None
    qty: float
    ts: int = Field(default_factory=lambda: int(time.time() * 1000))
    error: Optional[str] = None
    is_rollback: Optional[bool] = False
    original_order_id: Optional[str] = None


class CreateTwapRequest(BaseModel):
    name: str
    totalQty: float = Field(gt=0)
    sliceQty: float = Field(gt=0)
    intervalMs: int = Field(gt=0)
    legs: List[OrderTemplate] = Field(min_items=1)


class TwapControlRequest(BaseModel):
    action: Literal["start", "pause", "resume", "cancel"]


class TwapControlResponse(BaseModel):
    success: bool
    message: str
    newState: TwapState
