#!/usr/bin/env python3
"""
套利引擎測試腳本
測試後端套利引擎的基本功能
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, Any

# 測試配置
BASE_URL = "http://localhost:7000"
TEST_PAIR_ID = "test_bybit_btcusdt"

async def test_arbitrage_engine():
    """測試套利引擎功能"""
    print("🚀 開始測試套利引擎...")
    
    async with aiohttp.ClientSession() as session:
        try:
            # 1. 檢查引擎狀態
            print("\n1️⃣ 檢查引擎狀態...")
            async with session.get(f"{BASE_URL}/api/arbitrage/engine/status") as resp:
                status = await resp.json()
                print(f"   引擎狀態: {status}")
                
            # 2. 啟動引擎
            print("\n2️⃣ 啟動套利引擎...")
            async with session.post(f"{BASE_URL}/api/arbitrage/engine/control", 
                                  json={"action": "start"}) as resp:
                result = await resp.json()
                print(f"   啟動結果: {result}")
                
            # 3. 添加測試監控對
            print("\n3️⃣ 添加測試監控對...")
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
                "enabled": True
            }
            
            async with session.post(f"{BASE_URL}/api/arbitrage/pairs", 
                                  json=test_pair) as resp:
                result = await resp.json()
                print(f"   添加結果: {result}")
                
            # 4. 再次檢查引擎狀態
            print("\n4️⃣ 檢查更新後的引擎狀態...")
            async with session.get(f"{BASE_URL}/api/arbitrage/engine/status") as resp:
                status = await resp.json()
                print(f"   引擎狀態: {status}")
                
            # 5. 等待一段時間觀察日誌
            print("\n5️⃣ 等待 10 秒觀察引擎運行日誌...")
            await asyncio.sleep(10)
            
            # 6. 停用監控對
            print("\n6️⃣ 停用測試監控對...")
            test_pair["enabled"] = False
            async with session.post(f"{BASE_URL}/api/arbitrage/pairs", 
                                  json=test_pair) as resp:
                result = await resp.json()
                print(f"   停用結果: {result}")
                
            # 7. 移除監控對
            print("\n7️⃣ 移除測試監控對...")
            async with session.delete(f"{BASE_URL}/api/arbitrage/pairs/{TEST_PAIR_ID}") as resp:
                result = await resp.json()
                print(f"   移除結果: {result}")
                
            # 8. 停止引擎
            print("\n8️⃣ 停止套利引擎...")
            async with session.post(f"{BASE_URL}/api/arbitrage/engine/control", 
                                  json={"action": "stop"}) as resp:
                result = await resp.json()
                print(f"   停止結果: {result}")
                
            # 9. 最終狀態檢查
            print("\n9️⃣ 最終狀態檢查...")
            async with session.get(f"{BASE_URL}/api/arbitrage/engine/status") as resp:
                status = await resp.json()
                print(f"   最終狀態: {status}")
                
            print("\n✅ 套利引擎測試完成！")
            
        except Exception as e:
            print(f"\n❌ 測試失敗: {e}")
            import traceback
            traceback.print_exc()

async def test_health_check():
    """測試後端健康檢查"""
    print("\n🏥 測試後端健康檢查...")
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/health") as resp:
                health = await resp.json()
                print(f"   健康狀態: {health}")
                return health.get("success", False)
        except Exception as e:
            print(f"   ❌ 健康檢查失敗: {e}")
            return False

async def main():
    """主測試函數"""
    print("=" * 60)
    print("🧪 套利引擎測試腳本")
    print("=" * 60)
    
    # 檢查後端是否運行
    if not await test_health_check():
        print("❌ 後端未運行，請先啟動後端服務")
        print("   命令: cd python_backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 7000 --reload")
        return
        
    # 運行套利引擎測試
    await test_arbitrage_engine()
    
    print("\n" + "=" * 60)
    print("🎉 測試完成！")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

