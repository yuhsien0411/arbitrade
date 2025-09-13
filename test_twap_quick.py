#!/usr/bin/env python3
"""
TWAP 快速測試腳本
快速驗證 TWAP 基本功能
"""

import requests
import json
import time

API_BASE_URL = "http://localhost:7000"

def quick_test():
    """快速測試 TWAP 功能"""
    print("🚀 TWAP 快速測試開始...")
    
    # 1. 健康檢查
    print("\n1️⃣ 檢查 API 健康狀態...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ API 服務正常")
        else:
            print(f"❌ API 服務異常: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ 無法連接到 API: {e}")
        return
    
    # 2. 創建 TWAP 計畫
    print("\n2️⃣ 創建 TWAP 計畫...")
    test_plan = {
        "name": f"快速測試_{int(time.time())}",
        "totalQty": 0.001,  # 極小額測試
        "sliceQty": 0.0005,  # 分為2片
        "intervalMs": 3000,  # 3秒間隔
        "legs": [
            {
                "exchange": "bybit",
                "symbol": "BTCUSDT",
                "side": "buy",
                "type": "market"
            },
            {
                "exchange": "bybit",
                "symbol": "BTCUSDT", 
                "side": "sell",
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
                print(f"✅ 計畫創建成功: {plan_id}")
            else:
                print(f"❌ 計畫創建失敗: {data}")
                return
        else:
            print(f"❌ HTTP 錯誤: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ 創建計畫異常: {e}")
        return
    
    # 3. 啟動計畫
    print("\n3️⃣ 啟動 TWAP 計畫...")
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
                print("✅ 計畫啟動成功")
            else:
                print(f"❌ 計畫啟動失敗: {data}")
        else:
            print(f"❌ 啟動 HTTP 錯誤: {response.status_code}")
    except Exception as e:
        print(f"❌ 啟動異常: {e}")
    
    # 4. 等待執行
    print("\n4️⃣ 等待執行...")
    print("⏳ 等待 8 秒讓計畫執行...")
    time.sleep(8)
    
    # 5. 檢查狀態
    print("\n5️⃣ 檢查計畫狀態...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/status", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                status = data["data"]
                print(f"✅ 計畫狀態: {status.get('state', 'unknown')}")
                print(f"   已執行: {status.get('executed', 0)}")
                print(f"   剩餘: {status.get('remaining', 0)}")
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
                for i, exec_record in enumerate(executions[:3]):  # 只顯示前3條
                    print(f"   記錄 {i+1}: 成功={exec_record.get('success', False)}, 訂單ID={exec_record.get('orderId', 'N/A')}")
            else:
                print(f"❌ 執行記錄獲取失敗: {data}")
        else:
            print(f"❌ 記錄 HTTP 錯誤: {response.status_code}")
    except Exception as e:
        print(f"❌ 記錄檢查異常: {e}")
    
    # 7. 取消計畫
    print("\n7️⃣ 取消 TWAP 計畫...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/twap/{plan_id}/control",
            headers={"Content-Type": "application/json"},
            json={"action": "cancel"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ 計畫取消成功")
            else:
                print(f"❌ 計畫取消失敗: {data}")
        else:
            print(f"❌ 取消 HTTP 錯誤: {response.status_code}")
    except Exception as e:
        print(f"❌ 取消異常: {e}")
    
    # 8. 刪除計畫
    print("\n8️⃣ 刪除 TWAP 計畫...")
    try:
        response = requests.delete(f"{API_BASE_URL}/api/twap/plans/{plan_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ 計畫刪除成功")
            else:
                print(f"❌ 計畫刪除失敗: {data}")
        else:
            print(f"❌ 刪除 HTTP 錯誤: {response.status_code}")
    except Exception as e:
        print(f"❌ 刪除異常: {e}")
    
    print("\n🎉 快速測試完成！")

if __name__ == "__main__":
    quick_test()
