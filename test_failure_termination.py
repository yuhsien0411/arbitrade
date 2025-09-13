#!/usr/bin/env python3
"""
測試 TWAP 策略失敗終止功能
模擬餘額不足的情況，驗證策略是否會立即終止
"""

import requests
import json
import time
from datetime import datetime

API_BASE_URL = "http://localhost:7000"

def test_failure_termination():
    """測試失敗終止功能"""
    print("🧪 測試 TWAP 策略失敗終止功能")
    print("=" * 50)
    
    # 1. 檢查 API 健康狀態
    print("\n1️⃣ 檢查 API 健康狀態...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ API 服務正常")
            else:
                print("❌ API 服務異常")
                return
        else:
            print(f"❌ API 服務異常: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ 無法連接到 API: {e}")
        return
    
    # 2. 創建一個會失敗的 TWAP 策略（使用大數量模擬餘額不足）
    print("\n2️⃣ 創建測試策略（模擬餘額不足）...")
    test_plan = {
        "name": f"失敗終止測試_{int(time.time())}",
        "totalQty": 1000.0,  # 使用大數量確保餘額不足
        "sliceQty": 100.0,   # 單次數量
        "intervalMs": 5000,  # 5秒間隔
        "legs": [
            {
                "exchange": "bybit",
                "symbol": "BTCUSDT",
                "side": "buy",  # 現貨買入
                "type": "market"
            },
            {
                "exchange": "bybit", 
                "symbol": "BTCUSDT",
                "side": "sell",  # 合約賣出
                "type": "market"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/twap/plans",
            headers={"Content-Type": "application/json"},
            json=test_plan,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                plan_id = data["data"]["planId"]
                print(f"✅ 策略創建成功: {plan_id}")
                print(f"   策略名稱: {test_plan['name']}")
                print(f"   總數量: {test_plan['totalQty']} BTCUSDT")
                print(f"   單次數量: {test_plan['sliceQty']} BTCUSDT")
                print(f"   間隔時間: {test_plan['intervalMs']/1000} 秒")
            else:
                print(f"❌ 策略創建失敗: {data}")
                return
        else:
            print(f"❌ HTTP 錯誤: {response.status_code}")
            print(f"   響應內容: {response.text}")
            return
    except Exception as e:
        print(f"❌ 創建策略異常: {e}")
        return
    
    # 3. 啟動策略
    print("\n3️⃣ 啟動 TWAP 策略...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/twap/{plan_id}/control",
            headers={"Content-Type": "application/json"},
            json={"action": "start"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ 策略啟動成功")
                print("⏳ 等待策略執行（預期會因餘額不足而失敗）...")
            else:
                print(f"❌ 策略啟動失敗: {data}")
                return
        else:
            print(f"❌ 啟動 HTTP 錯誤: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ 啟動異常: {e}")
        return
    
    # 4. 監控策略狀態
    print("\n4️⃣ 監控策略狀態...")
    max_checks = 10  # 最多檢查10次
    check_count = 0
    
    while check_count < max_checks:
        time.sleep(2)  # 每2秒檢查一次
        check_count += 1
        
        try:
            response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/status", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    status = data["data"]
                    state = status.get("state", "unknown")
                    executed = status.get("executed", 0)
                    remaining = status.get("remaining", 0)
                    slices_done = status.get("slicesDone", 0)
                    slices_total = status.get("slicesTotal", 0)
                    
                    print(f"   📊 檢查 {check_count}: 狀態={state}, 已執行={executed}, 剩餘={remaining}, 完成={slices_done}/{slices_total}")
                    
                    # 如果策略被終止或完成，停止監控
                    if state in ["cancelled", "completed"]:
                        print(f"   🏁 策略已終止，狀態: {state}")
                        break
            else:
                print(f"   ❌ 狀態檢查失敗: {response.status_code}")
        except Exception as e:
            print(f"   ❌ 狀態檢查異常: {e}")
    
    # 5. 獲取最終狀態
    print("\n5️⃣ 獲取最終狀態...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/status", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                status = data["data"]
                state = status.get("state", "unknown")
                executed = status.get("executed", 0)
                remaining = status.get("remaining", 0)
                slices_done = status.get("slicesDone", 0)
                slices_total = status.get("slicesTotal", 0)
                
                print(f"✅ 最終狀態: {state}")
                print(f"   已執行數量: {executed} BTCUSDT")
                print(f"   剩餘數量: {remaining} BTCUSDT")
                print(f"   完成片數: {slices_done}/{slices_total}")
                
                # 驗證失敗終止
                if state == "cancelled":
                    print("✅ 策略正確終止（預期行為）")
                    if slices_done == 0:
                        print("✅ 沒有執行任何切片（預期行為）")
                    else:
                        print(f"⚠️ 執行了 {slices_done} 個切片（可能不是立即終止）")
                elif state == "completed":
                    print("❌ 策略意外完成（不應該發生）")
                else:
                    print(f"⚠️ 策略狀態異常: {state}")
            else:
                print(f"❌ 狀態獲取失敗: {data}")
        else:
            print(f"❌ 狀態 HTTP 錯誤: {response.status_code}")
    except Exception as e:
        print(f"❌ 狀態檢查異常: {e}")
    
    # 6. 獲取執行記錄
    print("\n6️⃣ 獲取執行記錄...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/executions", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                executions = data["data"]
                print(f"✅ 找到 {len(executions)} 條執行記錄")
                
                success_count = sum(1 for exec_record in executions if exec_record.get('success', False))
                failure_count = len(executions) - success_count
                
                print(f"   成功: {success_count} 條")
                print(f"   失敗: {failure_count} 條")
                
                if failure_count > 0:
                    print("✅ 發現失敗記錄（預期行為）")
                    for i, exec_record in enumerate(executions):
                        if not exec_record.get('success', False):
                            print(f"   失敗記錄 {i+1}: {exec_record.get('error', 'N/A')}")
                else:
                    print("⚠️ 沒有發現失敗記錄")
            else:
                print(f"❌ 執行記錄獲取失敗: {data}")
        else:
            print(f"❌ 記錄 HTTP 錯誤: {response.status_code}")
    except Exception as e:
        print(f"❌ 記錄檢查異常: {e}")
    
    # 7. 清理策略
    print("\n7️⃣ 清理策略...")
    try:
        response = requests.delete(f"{API_BASE_URL}/api/twap/plans/{plan_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ 策略已刪除")
            else:
                print("ℹ️ 策略刪除可能失敗")
        else:
            print("ℹ️ 刪除 HTTP 錯誤")
    except Exception as e:
        print(f"ℹ️ 刪除策略異常: {e}")
    
    print("\n🎉 失敗終止測試完成！")
    print("=" * 50)

if __name__ == "__main__":
    test_failure_termination()
