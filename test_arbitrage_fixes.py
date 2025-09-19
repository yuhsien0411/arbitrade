#!/usr/bin/env python3
"""
測試雙腿套利修復
驗證前後端API整合和套利引擎功能
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, Any

# 測試配置
BASE_URL = "http://localhost:7000"
TEST_PAIR_ID = "test_bybit_btcusdt_fixed"

async def test_arbitrage_fixes():
    """測試套利修復功能"""
    print("🚀 開始測試雙腿套利修復...")
    
    async with aiohttp.ClientSession() as session:
        try:
            # 0. 測試基本連接
            print("\n0️⃣ 測試基本連接...")
            try:
                async with session.get(f"{BASE_URL}/api/arbitrage/engine/status") as resp:
                    if resp.status == 200:
                        print("   ✅ 後端服務連接正常")
                    else:
                        print(f"   ❌ 後端服務響應異常: {resp.status}")
                        return
            except Exception as e:
                print(f"   ❌ 無法連接到後端服務: {e}")
                return
            # 1. 檢查引擎狀態
            print("\n1️⃣ 檢查套利引擎狀態...")
            async with session.get(f"{BASE_URL}/api/arbitrage/engine/status") as resp:
                status = await resp.json()
                print(f"   引擎狀態: {status}")
                
            # 2. 啟動引擎
            print("\n2️⃣ 啟動套利引擎...")
            async with session.post(f"{BASE_URL}/api/arbitrage/engine/control", 
                                  json={"action": "start"}) as resp:
                result = await resp.json()
                print(f"   啟動結果: {result}")
                
            # 3. 添加測試監控對（修復後的格式）
            print("\n3️⃣ 添加測試監控對（修復後格式）...")
            test_pair = {
                "pairId": TEST_PAIR_ID,
                "leg1": {
                    "exchange": "bybit",
                    "symbol": "BTCUSDT",
                    "type": "linear",
                    "side": "buy"
                },
                "leg2": {
                    "exchange": "bybit", 
                    "symbol": "BTCUSDT",
                    "type": "spot",
                    "side": "sell"
                },
                "threshold": 0.02,  # 0.02% 閾值
                "qty": 0.001,
                "enabled": True,
                "maxExecs": 1
            }
            
            async with session.post(f"{BASE_URL}/api/arbitrage/pairs", json=test_pair) as resp:
                result = await resp.json()
                print(f"   添加結果: {result}")
                
            # 4. 檢查監控對列表
            print("\n4️⃣ 檢查監控對列表...")
            async with session.get(f"{BASE_URL}/api/arbitrage/pairs") as resp:
                pairs = await resp.json()
                print(f"   監控對數量: {len(pairs.get('data', []))}")
                for pair in pairs.get('data', []):
                    print(f"   - {pair['id']}: {pair['leg1']['symbol']} {pair['leg1']['side']} vs {pair['leg2']['symbol']} {pair['leg2']['side']}")
                    
            # 5. 測試價格獲取
            print("\n5️⃣ 測試價格獲取...")
            async with session.get(f"{BASE_URL}/api/prices/bybit/BTCUSDT") as resp:
                price_data = await resp.json()
                print(f"   BTCUSDT 價格: {price_data}")
                
            # 6. 等待一段時間讓引擎運行
            print("\n6️⃣ 等待引擎運行（10秒）...")
            await asyncio.sleep(10)
            
            # 7. 檢查執行歷史
            print("\n7️⃣ 檢查執行歷史...")
            async with session.get(f"{BASE_URL}/api/arbitrage/executions") as resp:
                executions = await resp.json()
                print(f"   執行歷史: {executions}")
                
            # 8. 清理測試數據
            print("\n8️⃣ 清理測試數據...")
            async with session.delete(f"{BASE_URL}/api/arbitrage/pairs/{TEST_PAIR_ID}") as resp:
                result = await resp.json()
                print(f"   清理結果: {result}")
                
            print("\n✅ 測試完成！")
            
        except Exception as e:
            print(f"\n❌ 測試失敗: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_arbitrage_fixes())
