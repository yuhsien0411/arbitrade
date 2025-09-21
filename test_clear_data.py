#!/usr/bin/env python3
"""
測試資料清空功能
"""

import requests
import json
import time

def test_clear_data():
    """測試資料清空功能"""
    base_url = "http://localhost:7000"
    
    print("🧪 測試資料清空功能")
    print("=" * 50)
    
    try:
        # 1. 測試後端清空 API
        print("1. 測試後端清空 API...")
        response = requests.post(f"{base_url}/api/arbitrage/clear-all-data")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✅ 後端資料清空成功")
            else:
                print("❌ 後端資料清空失敗:", result.get("message"))
        else:
            print(f"❌ API 請求失敗: {response.status_code}")
            
        # 2. 檢查套利引擎狀態
        print("\n2. 檢查套利引擎狀態...")
        response = requests.get(f"{base_url}/api/arbitrage/engine/status")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                data = result.get("data", {})
                pairs_count = len(data.get("pairs", []))
                print(f"✅ 套利引擎狀態正常，監控對數量: {pairs_count}")
            else:
                print("❌ 獲取套利引擎狀態失敗")
        else:
            print(f"❌ 獲取套利引擎狀態失敗: {response.status_code}")
            
        # 3. 檢查套利交易對
        print("\n3. 檢查套利交易對...")
        response = requests.get(f"{base_url}/api/arbitrage/pairs")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                pairs = result.get("data", [])
                print(f"✅ 套利交易對數量: {len(pairs)}")
                if len(pairs) == 0:
                    print("✅ 套利交易對已清空")
                else:
                    print("⚠️ 套利交易對未完全清空")
            else:
                print("❌ 獲取套利交易對失敗")
        else:
            print(f"❌ 獲取套利交易對失敗: {response.status_code}")
            
        # 4. 檢查 TWAP 策略
        print("\n4. 檢查 TWAP 策略...")
        response = requests.get(f"{base_url}/api/twap/plans")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                plans = result.get("data", [])
                print(f"✅ TWAP 策略數量: {len(plans)}")
                if len(plans) == 0:
                    print("✅ TWAP 策略已清空")
                else:
                    print("⚠️ TWAP 策略未完全清空")
            else:
                print("❌ 獲取 TWAP 策略失敗")
        else:
            print(f"❌ 獲取 TWAP 策略失敗: {response.status_code}")
            
        print("\n" + "=" * 50)
        print("🎉 資料清空功能測試完成")
        
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到後端服務，請確保服務正在運行")
    except Exception as e:
        print(f"❌ 測試過程中發生錯誤: {e}")

if __name__ == "__main__":
    test_clear_data()
