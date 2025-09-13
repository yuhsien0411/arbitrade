#!/usr/bin/env python3
"""
TWAP 綜合功能測試腳本
測試 TWAP 策略的創建、啟動、執行、暫停、恢復、取消和刪除功能
支援單次數量模式和套利策略測試
"""

import requests
import json
import time
import asyncio
from typing import Dict, Any, List
from datetime import datetime

# 配置
API_BASE_URL = "http://localhost:7000"
HEADERS = {"Content-Type": "application/json"}

class TwapTester:
    """TWAP 測試類"""
    
    def __init__(self):
        self.test_results = []
        self.created_plans = []
        
    def log_test(self, test_name: str, success: bool, message: str = ""):
        """記錄測試結果"""
        status = "✅ PASS" if success else "❌ FAIL"
        timestamp = datetime.now().strftime("%H:%M:%S")
        result = f"[{timestamp}] {status} {test_name}"
        if message:
            result += f" - {message}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": timestamp
        })
        
    def test_api_health(self) -> bool:
        """測試 API 健康狀態"""
        try:
            response = requests.get(f"{API_BASE_URL}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("API 健康檢查", True, "服務正常運行")
                    return True
            self.log_test("API 健康檢查", False, f"狀態碼: {response.status_code}")
            return False
        except Exception as e:
            self.log_test("API 健康檢查", False, f"連接失敗: {str(e)}")
            return False
    
    def test_create_twap_plan(self) -> str:
        """測試創建 TWAP 計畫"""
        test_plan = {
            "name": f"測試TWAP策略_{int(time.time())}",
            "totalQty": 0.02,  # 總數量 = 單次數量 × 執行次數
            "sliceQty": 0.01,  # 單次數量
            "intervalMs": 5000,  # 5秒間隔
            "legs": [
                {
                    "exchange": "bybit",
                    "symbol": "ETHUSDT",
                    "side": "buy",
                    "type": "market"
                },
                {
                    "exchange": "bybit", 
                    "symbol": "ETHUSDT",
                    "side": "sell",
                    "type": "market"
                }
            ]
        }
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/twap/plans",
                headers=HEADERS,
                json=test_plan,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "planId" in data.get("data", {}):
                    plan_id = data["data"]["planId"]
                    self.created_plans.append(plan_id)
                    self.log_test("創建 TWAP 計畫", True, f"計畫ID: {plan_id}")
                    return plan_id
                else:
                    self.log_test("創建 TWAP 計畫", False, f"響應錯誤: {data}")
                    return None
            else:
                self.log_test("創建 TWAP 計畫", False, f"HTTP {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_test("創建 TWAP 計畫", False, f"異常: {str(e)}")
            return None
    
    def test_create_arbitrage_plan(self) -> str:
        """測試創建套利 TWAP 計畫 (現貨賣出 + 合約買入)"""
        arbitrage_plan = {
            "name": f"套利TWAP策略_{int(time.time())}",
            "totalQty": 0.02,  # 總數量 = 單次數量 × 執行次數
            "sliceQty": 0.01,  # 單次數量
            "intervalMs": 10000,  # 10秒間隔
            "legs": [
                {
                    "exchange": "bybit",
                    "symbol": "ETHUSDT",
                    "side": "sell",  # 現貨賣出
                    "type": "market"
                },
                {
                    "exchange": "bybit", 
                    "symbol": "ETHUSDT",
                    "side": "buy",   # 合約買入
                    "type": "market"
                }
            ]
        }
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/twap/plans",
                headers=HEADERS,
                json=arbitrage_plan,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "planId" in data.get("data", {}):
                    plan_id = data["data"]["planId"]
                    self.created_plans.append(plan_id)
                    self.log_test("創建套利 TWAP 計畫", True, f"計畫ID: {plan_id}")
                    return plan_id
                else:
                    self.log_test("創建套利 TWAP 計畫", False, f"響應錯誤: {data}")
                    return None
            else:
                self.log_test("創建套利 TWAP 計畫", False, f"HTTP {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_test("創建套利 TWAP 計畫", False, f"異常: {str(e)}")
            return None
    
    def test_single_quantity_mode(self) -> str:
        """測試單次數量模式"""
        single_qty_plan = {
            "name": f"單次數量測試_{int(time.time())}",
            "totalQty": 0.06,  # 總數量 = 0.02 × 3次
            "sliceQty": 0.02,  # 單次數量
            "intervalMs": 8000,  # 8秒間隔
            "legs": [
                {
                    "exchange": "bybit",
                    "symbol": "ETHUSDT",
                    "side": "buy",
                    "type": "market"
                },
                {
                    "exchange": "bybit", 
                    "symbol": "ETHUSDT",
                    "side": "sell",
                    "type": "market"
                }
            ]
        }
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/twap/plans",
                headers=HEADERS,
                json=single_qty_plan,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "planId" in data.get("data", {}):
                    plan_id = data["data"]["planId"]
                    self.created_plans.append(plan_id)
                    self.log_test("創建單次數量 TWAP 計畫", True, f"計畫ID: {plan_id}, 單次: 0.02, 總計: 0.06")
                    return plan_id
                else:
                    self.log_test("創建單次數量 TWAP 計畫", False, f"響應錯誤: {data}")
                    return None
            else:
                self.log_test("創建單次數量 TWAP 計畫", False, f"HTTP {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_test("創建單次數量 TWAP 計畫", False, f"異常: {str(e)}")
            return None
    
    def test_list_plans(self) -> bool:
        """測試獲取 TWAP 計畫列表"""
        try:
            response = requests.get(f"{API_BASE_URL}/api/twap/plans", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and isinstance(data.get("data"), list):
                    plan_count = len(data["data"])
                    self.log_test("獲取 TWAP 計畫列表", True, f"找到 {plan_count} 個計畫")
                    return True
                else:
                    self.log_test("獲取 TWAP 計畫列表", False, f"響應格式錯誤: {data}")
                    return False
            else:
                self.log_test("獲取 TWAP 計畫列表", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("獲取 TWAP 計畫列表", False, f"異常: {str(e)}")
            return False
    
    def test_start_plan(self, plan_id: str) -> bool:
        """測試啟動 TWAP 計畫"""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/twap/{plan_id}/control",
                headers=HEADERS,
                json={"action": "start"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("啟動 TWAP 計畫", True, f"計畫 {plan_id} 已啟動")
                    return True
                else:
                    self.log_test("啟動 TWAP 計畫", False, f"啟動失敗: {data}")
                    return False
            else:
                self.log_test("啟動 TWAP 計畫", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("啟動 TWAP 計畫", False, f"異常: {str(e)}")
            return False
    
    def test_pause_plan(self, plan_id: str) -> bool:
        """測試暫停 TWAP 計畫"""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/twap/{plan_id}/control",
                headers=HEADERS,
                json={"action": "pause"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("暫停 TWAP 計畫", True, f"計畫 {plan_id} 已暫停")
                    return True
                else:
                    self.log_test("暫停 TWAP 計畫", False, f"暫停失敗: {data}")
                    return False
            else:
                self.log_test("暫停 TWAP 計畫", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("暫停 TWAP 計畫", False, f"異常: {str(e)}")
            return False
    
    def test_resume_plan(self, plan_id: str) -> bool:
        """測試恢復 TWAP 計畫"""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/twap/{plan_id}/control",
                headers=HEADERS,
                json={"action": "resume"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("恢復 TWAP 計畫", True, f"計畫 {plan_id} 已恢復")
                    return True
                else:
                    self.log_test("恢復 TWAP 計畫", False, f"恢復失敗: {data}")
                    return False
            else:
                self.log_test("恢復 TWAP 計畫", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("恢復 TWAP 計畫", False, f"異常: {str(e)}")
            return False
    
    def test_cancel_plan(self, plan_id: str) -> bool:
        """測試取消 TWAP 計畫"""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/twap/{plan_id}/control",
                headers=HEADERS,
                json={"action": "cancel"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("取消 TWAP 計畫", True, f"計畫 {plan_id} 已取消")
                    return True
                else:
                    self.log_test("取消 TWAP 計畫", False, f"取消失敗: {data}")
                    return False
            else:
                self.log_test("取消 TWAP 計畫", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("取消 TWAP 計畫", False, f"異常: {str(e)}")
            return False
    
    def test_get_plan_status(self, plan_id: str) -> bool:
        """測試獲取計畫狀態"""
        try:
            response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/status", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    status_data = data.get("data", {})
                    state = status_data.get("state", "unknown")
                    self.log_test("獲取計畫狀態", True, f"狀態: {state}")
                    return True
                else:
                    self.log_test("獲取計畫狀態", False, f"狀態獲取失敗: {data}")
                    return False
            else:
                self.log_test("獲取計畫狀態", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("獲取計畫狀態", False, f"異常: {str(e)}")
            return False
    
    def test_get_executions(self, plan_id: str) -> bool:
        """測試獲取執行記錄"""
        try:
            response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/executions", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    executions = data.get("data", [])
                    self.log_test("獲取執行記錄", True, f"找到 {len(executions)} 條記錄")
                    return True
                else:
                    self.log_test("獲取執行記錄", False, f"記錄獲取失敗: {data}")
                    return False
            else:
                self.log_test("獲取執行記錄", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("獲取執行記錄", False, f"異常: {str(e)}")
            return False
    
    def test_update_plan(self, plan_id: str) -> bool:
        """測試更新 TWAP 計畫"""
        update_data = {
            "name": f"更新後的TWAP策略_{int(time.time())}",
            "totalQty": 0.04,  # 總數量 = 單次數量 × 執行次數
            "sliceQty": 0.02,  # 單次數量
            "intervalMs": 3000,
            "legs": [
                {
                    "exchange": "bybit",
                    "symbol": "ETHUSDT",
                    "side": "buy",
                    "type": "market"
                },
                {
                    "exchange": "bybit",
                    "symbol": "ETHUSDT", 
                    "side": "sell",
                    "type": "market"
                }
            ]
        }
        
        try:
            response = requests.put(
                f"{API_BASE_URL}/api/twap/plans/{plan_id}",
                headers=HEADERS,
                json=update_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("更新 TWAP 計畫", True, f"計畫 {plan_id} 已更新")
                    return True
                else:
                    self.log_test("更新 TWAP 計畫", False, f"更新失敗: {data}")
                    return False
            else:
                self.log_test("更新 TWAP 計畫", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("更新 TWAP 計畫", False, f"異常: {str(e)}")
            return False
    
    def test_delete_plan(self, plan_id: str) -> bool:
        """測試刪除 TWAP 計畫"""
        try:
            response = requests.delete(f"{API_BASE_URL}/api/twap/plans/{plan_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("刪除 TWAP 計畫", True, f"計畫 {plan_id} 已刪除")
                    return True
                else:
                    self.log_test("刪除 TWAP 計畫", False, f"刪除失敗: {data}")
                    return False
            else:
                self.log_test("刪除 TWAP 計畫", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("刪除 TWAP 計畫", False, f"異常: {str(e)}")
            return False
    
    def run_comprehensive_test(self):
        """運行綜合測試"""
        print("🧪 開始 TWAP 綜合功能測試...")
        print("📊 支援單次數量模式和套利策略測試")
        print("=" * 60)
        
        # 1. 健康檢查
        if not self.test_api_health():
            print("❌ API 服務不可用，測試終止")
            return
        
        # 2. 創建一般 TWAP 計畫
        plan_id = self.test_create_twap_plan()
        if not plan_id:
            print("❌ 無法創建 TWAP 計畫，測試終止")
            return
        
        # 2.5. 創建套利 TWAP 計畫
        arbitrage_plan_id = self.test_create_arbitrage_plan()
        if arbitrage_plan_id:
            print("⏳ 等待 2 秒讓套利策略開始執行...")
            time.sleep(2)
            self.test_get_executions(arbitrage_plan_id)
            self.test_cancel_plan(arbitrage_plan_id)
            self.test_delete_plan(arbitrage_plan_id)
        
        # 2.6. 測試單次數量模式
        single_qty_plan_id = self.test_single_quantity_mode()
        if single_qty_plan_id:
            print("⏳ 等待 3 秒讓單次數量策略開始執行...")
            time.sleep(3)
            self.test_get_executions(single_qty_plan_id)
            self.test_cancel_plan(single_qty_plan_id)
            self.test_delete_plan(single_qty_plan_id)
        
        # 3. 獲取計畫列表
        self.test_list_plans()
        
        # 4. 獲取計畫狀態
        self.test_get_plan_status(plan_id)
        
        # 5. 啟動計畫
        if self.test_start_plan(plan_id):
            print("⏳ 等待 3 秒讓計畫開始執行...")
            time.sleep(3)
            
            # 6. 獲取執行記錄
            self.test_get_executions(plan_id)
            
            # 7. 暫停計畫
            self.test_pause_plan(plan_id)
            time.sleep(1)
            
            # 8. 恢復計畫
            self.test_resume_plan(plan_id)
            time.sleep(2)
            
            # 9. 取消計畫
            self.test_cancel_plan(plan_id)
        
        # 10. 更新計畫（需要先取消）
        self.test_update_plan(plan_id)
        
        # 11. 刪除計畫
        self.test_delete_plan(plan_id)
        
        # 12. 最終檢查
        self.test_list_plans()
        
        # 輸出測試結果摘要
        self.print_summary()
    
    def print_summary(self):
        """打印測試結果摘要"""
        print("\n" + "=" * 60)
        print("📊 測試結果摘要")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"總測試數: {total_tests}")
        print(f"通過: {passed_tests} ✅")
        print(f"失敗: {failed_tests} ❌")
        print(f"成功率: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ 失敗的測試:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n🎯 測試完成！")

def main():
    """主函數"""
    tester = TwapTester()
    tester.run_comprehensive_test()

if __name__ == "__main__":
    main()
