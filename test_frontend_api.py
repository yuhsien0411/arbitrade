#!/usr/bin/env python3
"""
測試前端到後端的 API 調用
"""

import requests
import json

def test_api_calls():
    base_url = "http://localhost:7000"
    
    print("🧪 測試前端到後端的 API 調用")
    print("=" * 50)
    
    # 1. 測試獲取 API 設定
    print("1. 測試獲取 API 設定...")
    try:
        response = requests.get(f"{base_url}/api/settings/api")
        print(f"   狀態碼: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ 成功: {data}")
        else:
            print(f"   ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"   ❌ 錯誤: {e}")
    
    # 2. 測試更新 API 設定
    print("\n2. 測試更新 API 設定...")
    try:
        test_data = {
            "bybit": {
                "apiKey": "test_frontend_key",
                "secret": "test_frontend_secret"
            }
        }
        response = requests.put(
            f"{base_url}/api/settings/api",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        print(f"   狀態碼: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ 成功: {data}")
        else:
            print(f"   ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"   ❌ 錯誤: {e}")
    
    # 3. 測試 API 連接測試
    print("\n3. 測試 API 連接測試...")
    try:
        response = requests.post(f"{base_url}/api/settings/api/test")
        print(f"   狀態碼: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ 成功: {data}")
        else:
            print(f"   ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"   ❌ 錯誤: {e}")
    
    print("\n✅ 測試完成！")

if __name__ == "__main__":
    test_api_calls()
