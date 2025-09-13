#!/usr/bin/env python3
"""
ETHUSDT TWAP 策略測試
現貨賣出 + 永續合約買入
總數量: 0.02 ETHUSDT
執行: 2次，間隔10秒
"""

import requests
import json
import time
from datetime import datetime

API_BASE_URL = "http://localhost:7000"

def test_ethusdt_twap():
    """測試 ETHUSDT TWAP 策略"""
    print("🚀 ETHUSDT TWAP 策略測試")
    print("=" * 50)
    print("交易對: ETHUSDT")
    print("總數量: 0.02")
    print("現貨: 賣出 (sell)")
    print("永續合約: 買入 (buy)")
    print("執行次數: 2次")
    print("間隔時間: 10秒")
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
    
    # 2. 創建 ETHUSDT TWAP 策略
    print("\n2️⃣ 創建 ETHUSDT TWAP 策略...")
    twap_plan = {
        "name": f"ETHUSDT_TWAP_{int(time.time())}",
        "totalQty": 0.02,  # 總數量 0.02 ETHUSDT (單次數量 × 執行次數)
        "sliceQty": 0.01,  # 單次數量 0.01 ETHUSDT
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
                "side": "buy",   # 永續合約買入
                "type": "market"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/twap/plans",
            headers={"Content-Type": "application/json"},
            json=twap_plan,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                plan_id = data["data"]["planId"]
                print(f"✅ 策略創建成功: {plan_id}")
                print(f"   策略名稱: {twap_plan['name']}")
                print(f"   總數量: {twap_plan['totalQty']} ETHUSDT")
                print(f"   單次數量: {twap_plan['sliceQty']} ETHUSDT")
                print(f"   間隔時間: {twap_plan['intervalMs']/1000} 秒")
                print(f"   Leg 1 (現貨): {twap_plan['legs'][0]['side']} {twap_plan['legs'][0]['symbol']}")
                print(f"   Leg 2 (合約): {twap_plan['legs'][1]['side']} {twap_plan['legs'][1]['symbol']}")
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
                print("⏳ 開始執行交易...")
            else:
                print(f"❌ 策略啟動失敗: {data}")
                return
        else:
            print(f"❌ 啟動 HTTP 錯誤: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ 啟動異常: {e}")
        return
    
    # 4. 監控執行過程
    print("\n4️⃣ 監控執行過程...")
    print("等待策略執行完成...")
    
    for i in range(25):  # 監控25秒 (2次執行 + 10秒間隔 + 5秒緩衝)
        time.sleep(1)
        
        # 每5秒檢查一次狀態
        if i % 5 == 0:
            try:
                response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/status", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        status = data["data"]
                        print(f"   📊 狀態: {status.get('state', 'unknown')} | 已執行: {status.get('executed', 0)} | 剩餘: {status.get('remaining', 0)}")
                        
                        # 如果完成，提前結束監控
                        if status.get('state') == 'completed':
                            print("   ✅ 策略執行完成！")
                            break
            except:
                pass  # 忽略監控錯誤
    
    # 5. 獲取最終狀態
    print("\n5️⃣ 獲取最終狀態...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/twap/{plan_id}/status", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                status = data["data"]
                print(f"✅ 最終狀態: {status.get('state', 'unknown')}")
                print(f"   已執行數量: {status.get('executed', 0)} ETHUSDT")
                print(f"   剩餘數量: {status.get('remaining', 0)} ETHUSDT")
                print(f"   完成片數: {status.get('slicesDone', 0)}/{status.get('slicesTotal', 0)}")
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
                
                for i, exec_record in enumerate(executions):
                    success = exec_record.get('success', False)
                    order_id = exec_record.get('orderId', 'N/A')
                    leg_index = exec_record.get('legIndex', 0)
                    slice_index = exec_record.get('sliceIndex', 0)
                    leg_type = "現貨" if leg_index == 0 else "永續合約"
                    action = "賣出" if leg_index == 0 else "買入"
                    
                    status_icon = "✅" if success else "❌"
                    print(f"   {status_icon} 第{slice_index+1}片 - {leg_type} {action}: {order_id}")
            else:
                print(f"❌ 執行記錄獲取失敗: {data}")
        else:
            print(f"❌ 記錄 HTTP 錯誤: {response.status_code}")
    except Exception as e:
        print(f"❌ 記錄檢查異常: {e}")
    
    # 7. 取消策略（如果還在運行）
    print("\n7️⃣ 清理策略...")
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
                print("✅ 策略已取消")
            else:
                print("ℹ️ 策略可能已完成或已取消")
    except Exception as e:
        print(f"ℹ️ 取消策略異常: {e}")
    
    # 8. 刪除策略
    print("\n8️⃣ 刪除策略...")
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
    
    print("\n🎉 ETHUSDT TWAP 策略測試完成！")
    print("=" * 50)

if __name__ == "__main__":
    test_ethusdt_twap()
