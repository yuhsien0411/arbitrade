import requests
import json
import time

# 快速測試腳本
def quick_test():
    base_url = "http://localhost:5000"
    
    print("🚀 快速測試雙腿套利 API")
    print("=" * 40)
    
    # 1. 測試健康檢查
    print("1. 測試健康檢查...")
    try:
        response = requests.get(f"{base_url}/health")
        print(f"   狀態碼: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ 後端正常運行")
        else:
            print("   ❌ 後端異常")
            return
    except Exception as e:
        print(f"   ❌ 連接失敗: {e}")
        return
    
    # 2. 測試交易所狀態
    print("\n2. 測試交易所狀態...")
    try:
        response = requests.get(f"{base_url}/api/exchanges")
        data = response.json()
        print(f"   狀態碼: {response.status_code}")
        if isinstance(data, dict) and data.get('success'):
            exchanges = data.get('data', [])
            for exchange in exchanges:
                if isinstance(exchange, dict):
                    name = exchange.get('name', 'Unknown')
                    connected = exchange.get('connected', False)
                    status = "✅ 已連接" if connected else "❌ 未連接"
                    print(f"   - {name}: {status}")
                else:
                    print(f"   - 未知交易所: {exchange}")
        elif isinstance(data, list):
            # 如果直接返回數組
            for exchange in data:
                if isinstance(exchange, dict):
                    name = exchange.get('name', 'Unknown')
                    connected = exchange.get('connected', False)
                    status = "✅ 已連接" if connected else "❌ 未連接"
                    print(f"   - {name}: {status}")
                else:
                    print(f"   - 交易所: {exchange}")
        else:
            print("   ❌ 獲取交易所狀態失敗")
    except Exception as e:
        print(f"   ❌ 錯誤: {e}")
    
    # 3. 測試添加監控交易對
    print("\n3. 測試添加監控交易對...")
    pair_config = {
        "leg1": {
            "exchange": "bybit",
            "symbol": "BTCUSDT",
            "side": "buy",
            "qty": 0.001
        },
        "leg2": {
            "exchange": "binance",
            "symbol": "BTCUSDT", 
            "side": "sell",
            "qty": 0.001
        },
        "threshold": 0.5,
        "amount": 100.0,
        "enabled": True
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/monitoring/pairs",
            json=pair_config,
            headers={'Content-Type': 'application/json'}
        )
        print(f"   狀態碼: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("   ✅ 監控交易對添加成功")
                print(f"   ID: {data.get('data', {}).get('id', 'Unknown')}")
            else:
                print(f"   ❌ 添加失敗: {data.get('error', 'Unknown error')}")
        else:
            print(f"   ❌ HTTP 錯誤: {response.text}")
    except Exception as e:
        print(f"   ❌ 錯誤: {e}")
    
    # 4. 測試獲取監控交易對
    print("\n4. 測試獲取監控交易對...")
    try:
        response = requests.get(f"{base_url}/api/monitoring/pairs")
        data = response.json()
        print(f"   狀態碼: {response.status_code}")
        if data.get('success'):
            pairs = data.get('data', [])
            print(f"   ✅ 獲取成功，共 {len(pairs)} 個交易對")
            for pair in pairs:
                leg1 = pair.get('leg1', {})
                leg2 = pair.get('leg2', {})
                print(f"   - {leg1.get('symbol')} ({leg1.get('exchange')}) <-> {leg2.get('symbol')} ({leg2.get('exchange')})")
        else:
            print("   ❌ 獲取失敗")
    except Exception as e:
        print(f"   ❌ 錯誤: {e}")
    
    # 5. 測試賬戶信息
    print("\n5. 測試賬戶信息...")
    try:
        response = requests.get(f"{base_url}/api/account/bybit")
        data = response.json()
        print(f"   狀態碼: {response.status_code}")
        if data.get('success'):
            print("   ✅ 賬戶信息獲取成功")
            account_data = data.get('data', {})
            balance = account_data.get('balance', {})
            if balance.get('success'):
                total_equity = balance.get('data', {}).get('totalEquity', '0.00')
                print(f"   - 總權益: {total_equity} USDT")
        else:
            print(f"   ❌ 賬戶信息獲取失敗: {data.get('error', 'Unknown error')}")
    except Exception as e:
        print(f"   ❌ 錯誤: {e}")
    
    print("\n✅ 測試完成！")

if __name__ == "__main__":
    quick_test()
