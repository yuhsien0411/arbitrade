"""
TWAP 交易引擎
整合現有的 TWAP 交易器到 Python 後端
"""

import time
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from decimal import Decimal
from pybit.unified_trading import HTTP
import asyncio
from datetime import datetime, timedelta
import uuid

from ..utils.logger import get_logger
from ..config.env import config
from ..models.twap import TwapPlan, TwapProgress, TwapExecution, TwapState

logger = get_logger()


@dataclass
class ExchangeConfig:
    """交易所配置類"""
    api_key: str
    api_secret: str
    symbol: str
    testnet: bool = False
    demo: bool = True


@dataclass
class OrderResult:
    """訂單執行結果類"""
    success: bool
    price: Optional[Decimal]
    order_id: Optional[str]
    error_message: Optional[str] = None


class TWAPEngine:
    """TWAP 交易引擎主類"""
    
    def __init__(self):
        self.logger = logger
        self.plans: Dict[str, TwapPlan] = {}
        self.progress: Dict[str, TwapProgress] = {}
        self.executions: Dict[str, List[TwapExecution]] = {}
        self._running_tasks: Dict[str, asyncio.Task] = {}
        
        # 初始化 Bybit 客戶端
        self._init_clients()
    
    def clear_all_data(self) -> None:
        """清空所有 TWAP 引擎資料"""
        # 停止所有運行中的任務
        for task in self._running_tasks.values():
            if not task.done():
                task.cancel()
        
        self.plans.clear()
        self.progress.clear()
        self.executions.clear()
        self._running_tasks.clear()
        self.logger.info("twap_engine_data_cleared", success=True)

    def _init_clients(self):
        """初始化交易所客戶端"""
        try:
            # 強制使用真實網路（主網）
            use_testnet = False
            
            # 永續合約客戶端
            self.perpetual_client = HTTP(
                testnet=use_testnet,
                api_key=config.BYBIT_API_KEY or "",
                api_secret=config.BYBIT_SECRET or ""
            )
            
            # 現貨客戶端
            self.spot_client = HTTP(
                testnet=use_testnet,
                api_key=config.BYBIT_API_KEY or "",
                api_secret=config.BYBIT_SECRET or ""
            )
            
            self.logger.info("twap_engine_initialized", 
                            success=True, 
                            testnet=use_testnet,
                            network="MAINNET",
                            has_api_key=bool(config.BYBIT_API_KEY),
                            has_secret=bool(config.BYBIT_SECRET))
            
        except Exception as e:
            self.logger.error("twap_engine_init_failed", error=str(e))
            raise
    
    def _place_perp_order(self, symbol: str, quantity: str, side: str, price: Optional[str] = None) -> OrderResult:
        """下永續合約訂單（帶智能錯誤處理）"""
        try:
            response = self.perpetual_client.place_order(
                category="linear",
                symbol=symbol,
                side=side,
                orderType="Market",
                qty=quantity
            )
            
            if response['retCode'] == 0:
                return OrderResult(
                    success=True,
                    price=None,
                    order_id=response['result']['orderId'],
                    error_message=None
                )
            else:
                error_msg = f"永續合約下單失敗: {response['retMsg']}"
                self.logger.error("perp_order_failed", error=error_msg)
                
                # 檢查特定錯誤
                if 'ErrCode: 170131' in response['retMsg']:
                    # 餘額不足，直接返回失敗
                    return OrderResult(
                        success=False,
                        price=None,
                        order_id=None,
                        error_message=error_msg
                    )
                elif 'ErrCode: 170207' in response['retMsg']:
                    # 借貸池沒有幣可以借，等待後重試
                    return self._handle_borrowing_error(symbol, quantity, side, price)
                else:
                    return OrderResult(
                        success=False,
                        price=None,
                        order_id=None,
                        error_message=error_msg
                    )
                
        except Exception as e:
            error_msg = f"永續合約下單失敗: {str(e)}"
            self.logger.error("perp_order_exception", error=error_msg)
            
            # 檢查異常中的錯誤代碼
            if 'ErrCode: 170131' in str(e):
                # 餘額不足，直接返回失敗
                return OrderResult(
                    success=False,
                    price=None,
                    order_id=None,
                    error_message=error_msg
                )
            elif 'ErrCode: 170207' in str(e):
                # 借貸池沒有幣可以借，等待後重試
                return self._handle_borrowing_error(symbol, quantity, side, price)
            else:
                return OrderResult(
                    success=False,
                    price=None,
                    order_id=None,
                    error_message=error_msg
                )
    
    def _handle_borrowing_error(self, symbol: str, quantity: str, side: str, price: Optional[str]) -> OrderResult:
        """處理借貸錯誤（ErrCode: 170207）"""
        try:
            # 從 symbol 中提取幣種名稱
            coin_name = symbol.replace('USDT', '')
            
            self.logger.info("handling_borrowing_error", 
                           symbol=symbol, 
                           coin_name=coin_name,
                           error_code="170207")
            
            # 等待一段時間讓借貸池恢復
            import time
            wait_time = 10  # 等待10秒
            self.logger.info("waiting_for_borrowing_pool", 
                           wait_time=wait_time,
                           symbol=symbol)
            
            time.sleep(wait_time)
            
            # 重新嘗試下單
            return self._place_perp_order(symbol, quantity, side, price)
            
        except Exception as e:
            self.logger.error("borrowing_error_handling_failed", 
                            symbol=symbol,
                            error=str(e))
            return OrderResult(
                success=False,
                price=None,
                order_id=None,
                error_message=f"借貸錯誤處理失敗: {str(e)}"
            )

    def _place_spot_order(self, symbol: str, quantity: str, side: str, isLeverage: int = 0, price: Optional[str] = None) -> OrderResult:
        """下現貨訂單（帶智能錯誤處理和自動重試）"""
        try:
            # 預設使用非槓桿現貨：不傳 isLeverage 參數，避免 170344（現貨不支援保證金）
            # 僅當呼叫端明確要求槓桿現貨且該幣種支援時，再加上 isLeverage=1
            if isLeverage == 1:
                response = self.spot_client.place_order(
                    category="spot",
                    symbol=symbol,
                    isLeverage=1,
                    side=side,
                    orderType="Market",
                    qty=quantity,
                    marketUnit="baseCoin"
                )
            else:
                response = self.spot_client.place_order(
                    category="spot",
                    symbol=symbol,
                    side=side,
                    orderType="Market",
                    qty=quantity,
                    marketUnit="baseCoin"
                )
            
            if response['retCode'] == 0:
                return OrderResult(
                    success=True,
                    price=None,
                    order_id=response['result']['orderId'],
                    error_message=None
                )
            else:
                error_msg = f"現貨下單失敗: {response['retMsg']}"
                self.logger.error("spot_order_failed", error=error_msg)
                
                # 檢查特定錯誤並嘗試自動修復
                if 'ErrCode: 170037' in response['retMsg']:
                    return self._handle_collateral_error(symbol, quantity, side, isLeverage, price)
                elif 'ErrCode: 170131' in response['retMsg']:
                    # 餘額不足，直接返回失敗
                    return OrderResult(
                        success=False,
                        price=None,
                        order_id=None,
                        error_message=error_msg
                    )
                elif 'ErrCode: 170344' in response['retMsg']:
                    # 該交易對不支援現貨保證金，改用非槓桿現貨重試一次
                    self.logger.warning("spot_unsupported_margin_switch_to_cash", symbol=symbol)
                    return self._place_spot_order(symbol, quantity, side, isLeverage=0, price=price)
                else:
                    return OrderResult(
                        success=False,
                        price=None,
                        order_id=None,
                        error_message=error_msg
                    )
                
        except Exception as e:
            error_msg = f"現貨下單失敗: {str(e)}"
            self.logger.error("spot_order_exception", error=error_msg)
            
            # 檢查異常中的錯誤代碼
            if 'ErrCode: 170037' in str(e):
                return self._handle_collateral_error(symbol, quantity, side, isLeverage, price)
            elif 'ErrCode: 170131' in str(e):
                # 餘額不足，直接返回失敗
                return OrderResult(
                    success=False,
                    price=None,
                    order_id=None,
                    error_message=error_msg
                )
            elif 'ErrCode: 170344' in str(e):
                # 不支援現貨保證金（如 OMNIUSDT），改用非槓桿現貨重試
                self.logger.warning("spot_unsupported_margin_exception_switch_to_cash", symbol=symbol)
                return self._place_spot_order(symbol, quantity, side, isLeverage=0, price=price)
            else:
                return OrderResult(
                    success=False,
                    price=None,
                    order_id=None,
                    error_message=error_msg
                )
    
    def _handle_collateral_error(self, symbol: str, quantity: str, side: str, isLeverage: int, price: Optional[str]) -> OrderResult:
        """處理抵押設定錯誤（ErrCode: 170037）"""
        try:
            # 從 symbol 中提取幣種名稱（例如：BTCUSDT -> BTC）
            coin_name = symbol.replace('USDT', '')
            
            self.logger.info("attempting_collateral_fix", 
                           symbol=symbol, 
                           coin_name=coin_name,
                           error_code="170037")
            
            # 嘗試開啟抵押設定
            result = self.spot_client.set_collateral_coin(
                coin=coin_name,
                collateralSwitch="ON"
            )
            
            if result.get('retCode') == 0:
                self.logger.info("collateral_fix_success", 
                               coin_name=coin_name,
                               result=result)
                
                # 等待一小段時間讓設定生效
                import time
                time.sleep(1)
                
                # 重新嘗試下單
                return self._place_spot_order(symbol, quantity, side, isLeverage, price)
            else:
                self.logger.error("collateral_fix_failed", 
                                coin_name=coin_name,
                                error=result.get('retMsg', 'Unknown error'))
                return OrderResult(
                    success=False,
                    price=None,
                    order_id=None,
                    error_message=f"抵押設定修復失敗: {result.get('retMsg', 'Unknown error')}"
                )
                
        except Exception as e:
            self.logger.error("collateral_fix_exception", 
                            coin_name=coin_name,
                            error=str(e))
            return OrderResult(
                success=False,
                price=None,
                order_id=None,
                error_message=f"抵押設定修復異常: {str(e)}"
            )

    async def create_plan(self, plan: TwapPlan) -> str:
        """創建 TWAP 策略計畫"""
        plan_id = plan.planId
        self.plans[plan_id] = plan
        
        # 初始化進度追蹤
        self.progress[plan_id] = TwapProgress(
            planId=plan_id,
            executed=0.0,
            remaining=plan.totalQty,
            slicesDone=0,
            slicesTotal=int(plan.totalQty / plan.sliceQty),
            state=TwapState.PENDING
        )
        
        # 初始化執行記錄
        self.executions[plan_id] = []
        
        self.logger.info("twap_plan_created", 
                        planId=plan_id, 
                        name=plan.name,
                        totalQty=plan.totalQty,
                        success=True)
        
        return plan_id

    async def start_plan(self, plan_id: str) -> bool:
        """啟動 TWAP 策略計畫"""
        if plan_id not in self.plans:
            return False
        
        plan = self.plans[plan_id]
        progress = self.progress[plan_id]
        
        if progress.state != TwapState.PENDING:
            return False
        
        # 創建異步任務
        task = asyncio.create_task(self._execute_twap(plan_id))
        self._running_tasks[plan_id] = task
        
        progress.state = TwapState.RUNNING
        
        self.logger.info("twap_plan_started", planId=plan_id, success=True)
        return True

    async def pause_plan(self, plan_id: str) -> bool:
        """暫停 TWAP 策略計畫"""
        self.logger.info("twap_pause_plan_called", planId=plan_id, hasProgress=plan_id in self.progress)
        
        if plan_id not in self.progress:
            self.logger.warning("twap_pause_plan_not_found", planId=plan_id)
            return False
        
        progress = self.progress[plan_id]
        self.logger.info("twap_pause_plan_state_check", planId=plan_id, currentState=progress.state.value)
        
        # 允許暫停運行中的策略，即使有部分失敗
        if progress.state not in [TwapState.RUNNING, TwapState.PAUSED]:
            self.logger.warning("twap_pause_plan_invalid_state", planId=plan_id, currentState=progress.state.value)
            return False
        
        progress.state = TwapState.PAUSED
        
        # 取消任務
        if plan_id in self._running_tasks:
            self._running_tasks[plan_id].cancel()
            del self._running_tasks[plan_id]
        
        self.logger.info("twap_plan_paused", planId=plan_id, success=True)
        return True

    async def resume_plan(self, plan_id: str) -> bool:
        """恢復 TWAP 策略計畫"""
        if plan_id not in self.progress:
            return False
        
        progress = self.progress[plan_id]
        if progress.state != TwapState.PAUSED:
            return False
        
        # 創建異步任務
        task = asyncio.create_task(self._execute_twap(plan_id))
        self._running_tasks[plan_id] = task
        
        progress.state = TwapState.RUNNING
        
        self.logger.info("twap_plan_resumed", planId=plan_id, success=True)
        return True

    async def cancel_plan(self, plan_id: str) -> bool:
        """取消 TWAP 策略計畫"""
        if plan_id not in self.progress:
            return False
        
        progress = self.progress[plan_id]
        progress.state = TwapState.CANCELLED
        
        # 取消任務
        if plan_id in self._running_tasks:
            self._running_tasks[plan_id].cancel()
            del self._running_tasks[plan_id]
        
        self.logger.info("twap_plan_cancelled", planId=plan_id, success=True)
        return True
    
    async def emergency_rollback(self, plan_id: str) -> bool:
        """緊急回滾所有成功的腿"""
        if plan_id not in self.plans:
            return False
        
        plan = self.plans[plan_id]
        executions = self.executions.get(plan_id, [])
        
        # 找出所有成功的腿（非回滾）
        successful_legs = []
        for execution in executions:
            if execution.success and not execution.is_rollback:
                successful_legs.append({
                    'leg_index': execution.legIndex,
                    'leg': plan.legs[execution.legIndex],
                    'order_id': execution.orderId,
                    'side': plan.legs[execution.legIndex].side
                })
        
        if not successful_legs:
            self.logger.info("twap_emergency_rollback_no_legs", planId=plan_id)
            return True
        
        # 執行回滾
        await self._rollback_successful_legs(plan_id, -1, successful_legs)  # -1 表示緊急回滾
        
        self.logger.warning("twap_emergency_rollback_completed", 
                           planId=plan_id, 
                           rolledBackLegsCount=len(successful_legs))
        return True

    async def get_progress(self, plan_id: str) -> Optional[TwapProgress]:
        """取得 TWAP 策略計畫進度"""
        return self.progress.get(plan_id)

    async def get_executions(self, plan_id: str) -> Optional[List[TwapExecution]]:
        """取得 TWAP 策略執行記錄"""
        return self.executions.get(plan_id)
    
    async def _rollback_successful_legs(self, plan_id: str, slice_index: int, successful_legs: List[dict]):
        """回滾成功的腿，執行反向平倉"""
        plan = self.plans[plan_id]
        
        self.logger.warning("twap_rollback_started", 
                           planId=plan_id, 
                           sliceIndex=slice_index,
                           successfulLegsCount=len(successful_legs))
        
        for leg_info in successful_legs:
            leg_index = leg_info['leg_index']
            leg = leg_info['leg']
            original_order_id = leg_info['order_id']
            original_side = leg_info['side']
            
            # 計算反向操作
            reverse_side = "Sell" if original_side == "buy" else "Buy"
            
            try:
                # 執行反向平倉
                if leg.exchange == "bybit":
                    # 依據 leg 的 category 來決定走現貨或合約，避免用索引推斷
                    if getattr(leg, "category", "spot") == "spot":
                        rollback_result = self._place_spot_order(
                            symbol=leg.symbol,
                            quantity=str(plan.sliceQty),
                            side=reverse_side,
                            isLeverage=0
                        )
                    else:
                        rollback_result = self._place_perp_order(
                            symbol=leg.symbol,
                            quantity=str(plan.sliceQty),
                            side=reverse_side
                        )
                else:
                    rollback_result = OrderResult(
                        success=False,
                        price=None,
                        order_id=None,
                        error_message=f"Unsupported exchange for rollback: {leg.exchange}"
                    )
                
                # 記錄回滾結果
                rollback_execution = TwapExecution(
                    planId=plan_id,
                    sliceIndex=slice_index,
                    legIndex=leg_index,
                    orderId=rollback_result.order_id,
                    success=rollback_result.success,
                    price=float(rollback_result.price) if rollback_result.price else None,
                    qty=plan.sliceQty,
                    error=rollback_result.error_message
                )
                
                # 標記為回滾操作
                rollback_execution.is_rollback = True
                rollback_execution.original_order_id = original_order_id
                
                self.executions[plan_id].append(rollback_execution)
                
                if rollback_result.success:
                    self.logger.info("twap_rollback_success", 
                                   planId=plan_id, 
                                   sliceIndex=slice_index,
                                   legIndex=leg_index,
                                   originalOrderId=original_order_id,
                                   rollbackOrderId=rollback_result.order_id,
                                   success=True)
                else:
                    self.logger.error("twap_rollback_failed", 
                                    planId=plan_id, 
                                    sliceIndex=slice_index,
                                    legIndex=leg_index,
                                    originalOrderId=original_order_id,
                                    error=rollback_result.error_message)
                    
            except Exception as e:
                self.logger.error("twap_rollback_exception", 
                                planId=plan_id, 
                                sliceIndex=slice_index,
                                legIndex=leg_index,
                                originalOrderId=original_order_id,
                                error=str(e))
        
        self.logger.warning("twap_rollback_completed", 
                           planId=plan_id, 
                           sliceIndex=slice_index,
                           successfulLegsCount=len(successful_legs))

    async def _execute_twap(self, plan_id: str):
        """執行 TWAP 策略"""
        plan = self.plans[plan_id]
        progress = self.progress[plan_id]
        
        try:
            total_slices = int(plan.totalQty / plan.sliceQty)
            
            for slice_index in range(total_slices):
                if progress.state != TwapState.RUNNING:
                    break
                
                # 執行每個交易腿
                slice_failed = False
                successful_legs = []  # 記錄成功的腿
                
                for leg_index, leg in enumerate(plan.legs):
                    if progress.state != TwapState.RUNNING:
                        break
                    
                    # 根據交易所類型選擇客戶端
                    if leg.exchange == "bybit":
                        # 依據每個 leg 的 category 來決定走現貨或合約
                        if getattr(leg, "category", "spot") == "spot":
                            order_result = self._place_spot_order(
                                symbol=leg.symbol,
                                quantity=str(plan.sliceQty),
                                side="Buy" if leg.side == "buy" else "Sell",
                                isLeverage=0
                            )
                        else:
                            order_result = self._place_perp_order(
                                symbol=leg.symbol,
                                quantity=str(plan.sliceQty),
                                side="Buy" if leg.side == "buy" else "Sell"
                            )
                    else:
                        # 其他交易所的處理邏輯
                        order_result = OrderResult(
                            success=False,
                            price=None,
                            order_id=None,
                            error_message=f"Unsupported exchange: {leg.exchange}"
                        )
                    
                    # 記錄執行結果
                    execution = TwapExecution(
                        planId=plan_id,
                        sliceIndex=slice_index,
                        legIndex=leg_index,
                        orderId=order_result.order_id,
                        success=order_result.success,
                        price=float(order_result.price) if order_result.price else None,
                        qty=plan.sliceQty,
                        error=order_result.error_message
                    )
                    
                    self.executions[plan_id].append(execution)
                    
                    if order_result.success:
                        # 記錄成功的腿
                        successful_legs.append({
                            'leg_index': leg_index,
                            'leg': leg,
                            'order_id': order_result.order_id,
                            'side': leg.side
                        })
                        
                        progress.executed += plan.sliceQty
                        progress.remaining -= plan.sliceQty
                        progress.lastExecutionTs = int(time.time() * 1000)
                        
                        self.logger.info("twap_execution_success", 
                                       planId=plan_id, 
                                       sliceIndex=slice_index,
                                       legIndex=leg_index,
                                       orderId=order_result.order_id,
                                       success=True)
                    else:
                        self.logger.error("twap_execution_failed", 
                                        planId=plan_id, 
                                        sliceIndex=slice_index,
                                        legIndex=leg_index,
                                        error=order_result.error_message)
                        
                        # 如果有成功的腿，需要執行反向平倉
                        if successful_legs:
                            await self._rollback_successful_legs(plan_id, slice_index, successful_legs)
                        
                        # 下單失敗，立即終止策略
                        # 根據錯誤類型決定狀態
                        if "ErrCode: 10003" in order_result.error_message or "not authorized" in order_result.error_message.lower():
                            progress.state = TwapState.FAILED  # API 授權錯誤設為 FAILED
                        else:
                            progress.state = TwapState.CANCELLED  # 其他錯誤設為 CANCELLED
                        
                        progress.nextExecutionTs = None
                        slice_failed = True
                        self.logger.error("twap_plan_terminated_due_to_failure", 
                                        planId=plan_id, 
                                        sliceIndex=slice_index,
                                        legIndex=leg_index,
                                        error=order_result.error_message,
                                        finalState=progress.state.value)
                        break  # 跳出腿的循環
                
                progress.slicesDone = slice_index + 1
                
                # 如果切片失敗，立即終止策略
                if slice_failed:
                    break
                
                # 計算下次執行時間
                if slice_index < total_slices - 1:
                    progress.nextExecutionTs = int((time.time() + plan.intervalMs / 1000) * 1000)
                    await asyncio.sleep(plan.intervalMs / 1000)
            
            # 完成策略（只有在正常運行狀態下才標記為完成）
            if progress.state == TwapState.RUNNING:
                progress.state = TwapState.COMPLETED
                progress.nextExecutionTs = None
                
                self.logger.info("twap_plan_completed", 
                               planId=plan_id,
                               totalExecuted=progress.executed,
                               success=True)
            elif progress.state == TwapState.CANCELLED:
                self.logger.error("twap_plan_terminated", 
                               planId=plan_id,
                               totalExecuted=progress.executed,
                               success=False)
        
        except asyncio.CancelledError:
            self.logger.info("twap_plan_cancelled", planId=plan_id, success=True)
        except Exception as e:
            self.logger.error("twap_execution_error", 
                            planId=plan_id, 
                            error=str(e))
            progress.state = TwapState.FAILED
        finally:
            # 清理任務
            if plan_id in self._running_tasks:
                del self._running_tasks[plan_id]


# 全域 TWAP 引擎實例
twap_engine = TWAPEngine()