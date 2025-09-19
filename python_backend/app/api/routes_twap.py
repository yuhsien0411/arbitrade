from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import time

from ..models.twap import (
    TwapPlan, TwapProgress, CreateTwapRequest, TwapControlRequest, TwapControlResponse, TwapState
)
from ..services.twap_engine import twap_engine
from ..utils.logger import get_logger


router = APIRouter()
logger = get_logger()


@router.post("/twap/plans")
async def create_twap_plan(request: CreateTwapRequest):
    """建立 TWAP 計畫"""
    try:
        plan = TwapPlan(
            name=request.name,
            totalQty=request.totalQty,
            sliceQty=request.sliceQty,
            intervalMs=request.intervalMs,
            legs=request.legs
        )
        
        plan_id = await twap_engine.create_plan(plan)
        
        logger.info("twap_plan_created", planId=plan_id, success=True)
        
        return {"success": True, "data": {"planId": plan_id}}
        
    except Exception as e:
        logger.error("twap_plan_create_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"Failed to create TWAP plan: {str(e)}"}
        )


@router.get("/twap/{plan_id}/status")
async def get_twap_status(plan_id: str):
    """取得 TWAP 計畫狀態"""
    progress = await twap_engine.get_progress(plan_id)
    
    if not progress:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "TWAP plan not found"}
        )
    
    return {"success": True, "data": progress.dict()}


@router.post("/twap/{plan_id}/control")
async def control_twap_plan(plan_id: str, request: TwapControlRequest):
    """控制 TWAP 計畫（開始/暫停/恢復/取消）"""
    try:
        logger.info("twap_control_request", planId=plan_id, action=request.action)
        success = False
        new_state = None
        
        if request.action == "start":
            success = await twap_engine.start_plan(plan_id)
            new_state = "running" if success else None
        elif request.action == "pause":
            success = await twap_engine.pause_plan(plan_id)
            new_state = "paused" if success else None
            logger.info("twap_pause_attempt", planId=plan_id, success=success)
        elif request.action == "resume":
            success = await twap_engine.resume_plan(plan_id)
            new_state = "running" if success else None
        elif request.action == "cancel":
            success = await twap_engine.cancel_plan(plan_id)
            new_state = "cancelled" if success else None
        else:
            raise HTTPException(
                status_code=400,
                detail={"code": "VALIDATION_ERROR", "message": "Invalid action"}
            )
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_STATE", "message": "Cannot perform action in current state"}
            )
        
        logger.info("twap_control", planId=plan_id, action=request.action, success=True)
        
        return {"success": True, "data": {"newState": new_state}}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("twap_control_failed", planId=plan_id, action=request.action, error=str(e))
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"Failed to control TWAP plan: {str(e)}"}
        )


@router.get("/twap/{plan_id}/executions")
async def get_twap_executions(plan_id: str):
    """取得 TWAP 執行記錄"""
    executions = await twap_engine.get_executions(plan_id)
    
    if executions is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "TWAP plan not found"}
        )
    
    return {"success": True, "data": executions}


@router.get("/twap/plans")
async def list_twap_plans():
    """列出所有 TWAP 計畫"""
    plans = []
    for plan_id, plan in twap_engine.plans.items():
        progress = await twap_engine.get_progress(plan_id)
        plan_data = {
            "planId": plan_id,
            "name": plan.name,
            "totalQty": plan.totalQty,
            "sliceQty": plan.sliceQty,
            "intervalMs": plan.intervalMs,
            "legs": [leg.dict() for leg in plan.legs],
            "createdAt": plan.createdAt,
            "state": progress.state.value if progress else "unknown",
            "progress": progress.dict() if progress else None
        }
        plans.append(plan_data)
    
    return {"success": True, "data": plans}


@router.put("/twap/plans/{plan_id}")
async def update_twap_plan(plan_id: str, request: CreateTwapRequest):
    """更新 TWAP 計畫"""
    try:
        if plan_id not in twap_engine.plans:
            raise HTTPException(
                status_code=404,
                detail={"code": "NOT_FOUND", "message": "TWAP plan not found"}
            )
        
        # 檢查計畫是否正在運行
        progress = await twap_engine.get_progress(plan_id)
        if progress and progress.state.value in ["running", "paused"]:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_STATE", "message": "Cannot update running or paused plan"}
            )
        
        # 創建新的計畫對象
        updated_plan = TwapPlan(
            planId=plan_id,
            name=request.name,
            totalQty=request.totalQty,
            sliceQty=request.sliceQty,
            intervalMs=request.intervalMs,
            legs=request.legs,
            createdAt=twap_engine.plans[plan_id].createdAt  # 保持原始創建時間
        )
        
        # 更新計畫
        twap_engine.plans[plan_id] = updated_plan
        
        # 重新初始化進度追蹤
        twap_engine.progress[plan_id] = TwapProgress(
            planId=plan_id,
            executed=0.0,
            remaining=request.totalQty,
            slicesDone=0,
            slicesTotal=int(request.totalQty / request.sliceQty),
            state=TwapState.PENDING
        )
        
        # 清空執行記錄
        twap_engine.executions[plan_id] = []
        
        logger.info("twap_plan_updated", planId=plan_id, success=True)
        
        return {"success": True, "data": {"planId": plan_id}}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("twap_plan_update_failed", planId=plan_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"Failed to update TWAP plan: {str(e)}"}
        )


@router.post("/twap/{plan_id}/emergency-rollback")
async def emergency_rollback(plan_id: str):
    """緊急回滾 TWAP 計畫的所有成功腿"""
    try:
        if plan_id not in twap_engine.plans:
            raise HTTPException(
                status_code=404,
                detail={"code": "NOT_FOUND", "message": "TWAP plan not found"}
            )
        
        success = await twap_engine.emergency_rollback(plan_id)
        
        if success:
            logger.info("twap_emergency_rollback_success", planId=plan_id)
            return {"success": True, "message": "Emergency rollback completed"}
        else:
            raise HTTPException(
                status_code=500,
                detail={"code": "INTERNAL_ERROR", "message": "Emergency rollback failed"}
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("twap_emergency_rollback_failed", planId=plan_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"Emergency rollback failed: {str(e)}"}
        )


@router.delete("/twap/plans/{plan_id}")
async def delete_twap_plan(plan_id: str):
    """刪除 TWAP 計畫"""
    try:
        if plan_id not in twap_engine.plans:
            raise HTTPException(
                status_code=404,
                detail={"code": "NOT_FOUND", "message": "TWAP plan not found"}
            )
        
        # 檢查計畫是否正在運行
        progress = await twap_engine.get_progress(plan_id)
        if progress and progress.state.value in ["running", "paused"]:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_STATE", "message": "Cannot delete running or paused plan. Please cancel it first."}
            )
        
        # 取消正在運行的任務（如果有的話）
        if plan_id in twap_engine._running_tasks:
            twap_engine._running_tasks[plan_id].cancel()
            del twap_engine._running_tasks[plan_id]
        
        # 刪除計畫和相關數據
        del twap_engine.plans[plan_id]
        if plan_id in twap_engine.progress:
            del twap_engine.progress[plan_id]
        if plan_id in twap_engine.executions:
            del twap_engine.executions[plan_id]
        
        logger.info("twap_plan_deleted", planId=plan_id, success=True)
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("twap_plan_delete_failed", planId=plan_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"Failed to delete TWAP plan: {str(e)}"}
        )