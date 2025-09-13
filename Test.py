import requests
import json
import time
import threading
from datetime import datetime

class ArbitrageSimulator:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'ArbitrageSimulator/1.0'
        })
    
    def test_connection(self):
        """測試後端連接"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                print("✅ 後端連接成功")
                return True
            else:
                print(f"❌ 後端連接失敗: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 連接錯誤: {e}")
            return False
    
    def get_exchanges(self):
        """獲取交易所狀態"""
        try:
            response = self.session.get(f"{self.base_url}/api/exchanges")
            if response.status_code == 200:
                data = response.json()
                print("📊 交易所狀態:")
                if isinstance(data, dict) and 'data' in data:
                    exchanges = data.get('data', [])
                    for exchange in exchanges:
                        if isinstance(exchange, dict):
                            name = exchange.get('name', 'Unknown')
                            connected = exchange.get('connected', False)
                            status = '✅ 已連接' if connected else '❌ 未連接'
                            print(f"  - {name}: {status}")
                        else:
                            print(f"  - 未知交易所: {exchange}")
                    return exchanges
                elif isinstance(data, list):
                    # 如果直接返回數組
                    for exchange in data:
                        if isinstance(exchange, dict):
                            name = exchange.get('name', 'Unknown')
                            connected = exchange.get('connected', False)
                            status = '✅ 已連接' if connected else '❌ 未連接'
                            print(f"  - {name}: {status}")
                        else:
                            print(f"  - 交易所: {exchange}")
                    return data
                else:
                    print(f"  - 響應格式異常: {data}")
                    return []
            else:
                print(f"❌ 獲取交易所狀態失敗: {response.status_code}")
                return []
        except Exception as e:
            print(f"❌ 獲取交易所狀態錯誤: {e}")
            return []

    def get_ticker(self, exchange="binance", symbol="BTCUSDT", category="spot"):
        """測試獲取公開 ticker（最優買一/賣一）"""
        try:
            url = f"{self.base_url}/api/ticker/{exchange}/{symbol}?category={category}"
            resp = self.session.get(url)
            if resp.status_code == 200:
                data = resp.json()
                tk = data.get("data", {})
                bid = tk.get("bid1", {}).get("price")
                ask = tk.get("ask1", {}).get("price")
                cached = data.get("cached") or data.get("fallback")
                print(f"📈 {exchange.upper()} {symbol} ({category}) bid/ask = {bid} / {ask}  {'[cached]' if cached else ''}")
                return tk
            else:
                print(f"❌ 獲取 ticker 失敗: {resp.status_code} - {resp.text}")
                return None
        except Exception as e:
            print(f"❌ 獲取 ticker 錯誤: {e}")
            return None
    
    def add_monitoring_pair(self, pair_config):
        """添加監控交易對"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/monitoring/pairs",
                json=pair_config
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 監控交易對添加成功: {pair_config['leg1']['symbol']} <-> {pair_config['leg2']['symbol']}")
                return data.get('data')
            else:
                print(f"❌ 添加監控交易對失敗: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ 添加監控交易對錯誤: {e}")
            return None
    
    def get_monitoring_pairs(self):
        """獲取監控交易對列表"""
        try:
            response = self.session.get(f"{self.base_url}/api/monitoring/pairs")
            if response.status_code == 200:
                data = response.json()
                pairs = data.get('data', [])
                print(f"📋 當前監控交易對數量: {len(pairs)}")
                for pair in pairs:
                    print(f"  - {pair['leg1']['symbol']} ({pair['leg1']['exchange']}) <-> {pair['leg2']['symbol']} ({pair['leg2']['exchange']})")
                return pairs
            else:
                print(f"❌ 獲取監控交易對失敗: {response.status_code}")
                return []
        except Exception as e:
            print(f"❌ 獲取監控交易對錯誤: {e}")
            return []
    
    def get_account_info(self, exchange="bybit"):
        """獲取賬戶信息"""
        try:
            response = self.session.get(f"{self.base_url}/api/account/{exchange}")
            if response.status_code == 200:
                data = response.json()
                print(f"💰 {exchange.upper()} 賬戶信息:")
                if data.get('success'):
                    account_data = data.get('data', {})
                    balance = account_data.get('balance', {})
                    if balance.get('success'):
                        total_equity = balance.get('data', {}).get('totalEquity', '0.00')
                        print(f"  - 總權益: {total_equity} USDT")
                    positions = account_data.get('positions', {})
                    if positions.get('success'):
                        pos_list = positions.get('data', {}).get('list', [])
                        print(f"  - 持倉數量: {len(pos_list)}")
                return data
            else:
                print(f"❌ 獲取{exchange}賬戶信息失敗: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ 獲取{exchange}賬戶信息錯誤: {e}")
            return None
    
    def simulate_arbitrage_requests(self):
        """模擬雙腿套利請求"""
        print("🚀 開始模擬雙腿套利請求...")
        
        # 測試連接
        if not self.test_connection():
            return
        
        # 獲取交易所狀態
        exchanges = self.get_exchanges()
        
        # 先測試幣安/拜比特公開 ticker
        self.get_ticker("binance", "BTCUSDT", "spot")
        self.get_ticker("binance", "BTCUSDT", "futures")
        self.get_ticker("bybit", "BTCUSDT", "spot")

        # 獲取賬戶信息
        self.get_account_info("bybit")
        
        # 定義多個套利交易對配置
        current_time = int(time.time())
        arbitrage_pairs = [
            {
                "id": f"pair_{current_time}_0",
                "leg1": {
                    "exchange": "bybit",
                    "symbol": "BTCUSDT",
                    "type": "linear",
                    "side": "buy",
                    "qty": 0.001
                },
                "leg2": {
                    "exchange": "bybit",
                    "symbol": "BTCUSDT",
                    "type": "spot",
                    "side": "sell",
                    "qty": 0.001
                },
                "threshold": 0.5,
                "amount": 100.0,
                "enabled": True,
                "createdAt": int(time.time() * 1000)
            }
  

        ]

            
        
        
        # 添加監控交易對
        added_pairs = []
        for i, pair in enumerate(arbitrage_pairs):
            print(f"\n📝 添加第 {i+1} 個監控交易對...")
            result = self.add_monitoring_pair(pair)
            if result:
                added_pairs.append(result)
            time.sleep(1)  # 避免請求過快
        
        # 獲取所有監控交易對
        print("\n📋 獲取所有監控交易對...")
        all_pairs = self.get_monitoring_pairs()
        
        # 模擬定期檢查
        print("\n🔄 開始定期檢查套利機會...")
        for i in range(5):
            print(f"\n--- 第 {i+1} 次檢查 ---")
            self.get_monitoring_pairs()
            time.sleep(2)
        
        print("\n✅ 模擬完成！")
        return added_pairs

def main():
    """主函數"""
    print("🎯 雙腿套利模擬器")
    print("=" * 50)
    
    simulator = ArbitrageSimulator()
    
    try:
        # 執行模擬
        simulator.simulate_arbitrage_requests()
        
    except KeyboardInterrupt:
        print("\n\n⏹️ 模擬被用戶中斷")
    except Exception as e:
        print(f"\n❌ 模擬過程中發生錯誤: {e}")
    
    print("\n👋 再見！")

if __name__ == "__main__":
    main()