import requests
import time
from datetime import datetime


BASE_URL = "http://localhost:5000"


def add_twap_strategy(symbol: str = "BTCUSDT",
                      side: str = "buy",
                      total_amount: float = 10.0,
                      time_interval_sec: int = 5,
                      order_count: int = 3):
    """
    向後端新增一個 TWAP 策略。

    參數對齊後端 /api/twap/strategies：
    - symbol: 交易對
    - side: buy/sell
    - totalAmount: 總金額或總數量（系統會均分）
    - timeInterval: 兩筆下單間隔（秒）
    - orderCount: 總筆數
    """
    payload = {
        "symbol": symbol,
        "side": side,
        "totalAmount": float(total_amount),
        "timeInterval": int(time_interval_sec),
        "orderCount": int(order_count),
    }

    print(f"\n[POST] /api/twap/strategies  {payload}")
    res = requests.post(f"{BASE_URL}/api/twap/strategies", json=payload, timeout=15)
    print(f"-> status={res.status_code}")
    print(res.json())
    return res.json()


def list_twap_strategies():
    res = requests.get(f"{BASE_URL}/api/twap/strategies", timeout=15)
    data = res.json()
    strategies = data.get("data", []) if isinstance(data, dict) else []
    print("\n[GET] /api/twap/strategies")
    print(f"共 {len(strategies)} 個策略")
    for s in strategies:
        sid = s.get("id") or s.get("strategyId")
        print(f"  - id={sid} symbol={s.get('symbol')} side={s.get('side')} executed={s.get('executedOrders', 0)}/{s.get('orderCount')} consumed={s.get('consumedAmount', 0)}/{s.get('totalAmount')}")
    return strategies


def main():
    print("TWAP 測試啟動", datetime.now().isoformat())

    # 新增一個小額 TWAP 策略（請自行調整數值）
    add_twap_strategy(
        symbol="BTCUSDT",
        side="buy",
        total_amount=10.0,         # 總金額/數量
        time_interval_sec=5,       # 每 5 秒下一筆
        order_count=3              # 總共 3 筆
    )

    # 觀察一段時間
    for i in range(8):
        list_twap_strategies()
        time.sleep(5)

    print("\nTWAP 測試完成")


if __name__ == "__main__":
    main()





