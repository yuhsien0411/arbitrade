#!/usr/bin/env python3
"""
TWAP CRUD 功能測試腳本
測試新增、修改、刪除 TWAP 計畫的功能
"""

import requests
import json
import time
from typing import Dict, Any

# 配置
API_BASE_URL = "http://localhost:7000"
HEADERS = {"Content-Type": "application/json"}

def test_twap_crud():
    """測試 TWAP CRUD 功能"""
    print("🧪 開始測試 TWAP CRUD 功能...")
    
    # 測試數據
    test_plan = {
        "name": "測試TWAP策略",
        "totalQty": 1.0,
        "sliceQty": 0.1,
        "intervalMs": 5000,  # 5秒間隔
        "legs": [
            {
                "exchange": "bybit",
                "symbol": "BTCUSDT",
                "side": "buy",
                "type": "market"
            }
        ]
    }
    
    plan_id = None
    
    try:
        # 1. 測試創建 TWAP 計畫
        print("\n1️⃣ 測試創建 TWAP 計畫...")
        response = requests.post(
            f"{API_BASE_URL}/twap/plans",
            headers=HEADERS,
            json=test_plan
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                plan_id = data["data"]["planId"]
                print(f"✅ 創建成功，計畫ID: {plan_id}")
            else:
                print(f"❌ 創建失敗: {data.get('error', '未知錯誤')}")
                return False
        else:
            print(f"❌ 創建失敗，狀態碼: {response.status_code}")
            print(f"響應內容: {response.text}")
            return False
        
        # 2. 測試獲取 TWAP 計畫列表
        print("\n2️⃣ 測試獲取 TWAP 計畫列表...")
        response = requests.get(f"{API_BASE_URL}/twap/plans")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                plans = data["data"]
                print(f"✅ 獲取成功，共 {len(plans)} 個計畫")
                for plan in plans:
                    print(f"   - {plan['name']} (ID: {plan['planId']})")
            else:
                print(f"❌ 獲取失敗: {data.get('error', '未知錯誤')}")
                return False
        else:
            print(f"❌ 獲取失敗，狀態碼: {response.status_code}")
            return False
        
        # 3. 測試更新 TWAP 計畫
        print("\n3️⃣ 測試更新 TWAP 計畫...")
        updated_plan = test_plan.copy()
        updated_plan["name"] = "更新後的TWAP策略"
        updated_plan["totalQty"] = 2.0
        
        response = requests.put(
            f"{API_BASE_URL}/twap/plans/{plan_id}",
            headers=HEADERS,
            json=updated_plan
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ 更新成功")
            else:
                print(f"❌ 更新失敗: {data.get('error', '未知錯誤')}")
                return False
        else:
            print(f"❌ 更新失敗，狀態碼: {response.status_code}")
            print(f"響應內容: {response.text}")
            return False
        
        # 4. 驗證更新結果
        print("\n4️⃣ 驗證更新結果...")
        response = requests.get(f"{API_BASE_URL}/twap/plans")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                plans = data["data"]
                updated_plan_found = False
                for plan in plans:
                    if plan["planId"] == plan_id:
                        if plan["name"] == "更新後的TWAP策略" and plan["totalQty"] == 2.0:
                            print("✅ 更新驗證成功")
                            updated_plan_found = True
                        else:
                            print(f"❌ 更新驗證失敗: 名稱={plan['name']}, 數量={plan['totalQty']}")
                        break
                
                if not updated_plan_found:
                    print("❌ 找不到更新後的計畫")
                    return False
            else:
                print(f"❌ 驗證失敗: {data.get('error', '未知錯誤')}")
                return False
        else:
            print(f"❌ 驗證失敗，狀態碼: {response.status_code}")
            return False
        
        # 5. 測試刪除 TWAP 計畫
        print("\n5️⃣ 測試刪除 TWAP 計畫...")
        response = requests.delete(f"{API_BASE_URL}/twap/plans/{plan_id}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ 刪除成功")
            else:
                print(f"❌ 刪除失敗: {data.get('error', '未知錯誤')}")
                return False
        else:
            print(f"❌ 刪除失敗，狀態碼: {response.status_code}")
            print(f"響應內容: {response.text}")
            return False
        
        # 6. 驗證刪除結果
        print("\n6️⃣ 驗證刪除結果...")
        response = requests.get(f"{API_BASE_URL}/twap/plans")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                plans = data["data"]
                plan_exists = any(plan["planId"] == plan_id for plan in plans)
                if not plan_exists:
                    print("✅ 刪除驗證成功")
                else:
                    print("❌ 刪除驗證失敗: 計畫仍然存在")
                    return False
            else:
                print(f"❌ 驗證失敗: {data.get('error', '未知錯誤')}")
                return False
        else:
            print(f"❌ 驗證失敗，狀態碼: {response.status_code}")
            return False
        
        print("\n🎉 所有 TWAP CRUD 測試通過！")
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到 API 服務器，請確保 Python 後端正在運行")
        return False
    except Exception as e:
        print(f"❌ 測試過程中發生錯誤: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_twap_crud()
    exit(0 if success else 1)
