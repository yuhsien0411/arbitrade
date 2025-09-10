import websocket
import json
import time
import threading

class WebSocketTester:
    def __init__(self, url="ws://localhost:5000"):
        self.url = url
        self.ws = None
        self.connected = False
        
    def on_message(self, ws, message):
        """處理接收到的消息"""
        try:
            data = json.loads(message)
            print(f"📨 收到消息: {data}")
            
            # 處理不同類型的消息
            if data.get('type') == 'welcome':
                print(f"   🎉 {data.get('message')}")
            elif data.get('type') == 'arbitrageOpportunity':
                print(f"   💰 套利機會: {data.get('data')}")
            elif data.get('type') == 'arbitrageTrigger':
                print(f"   ⚡ 套利觸發: {data.get('data')}")
            else:
                print(f"   📋 其他消息: {data}")
                
        except Exception as e:
            print(f"❌ 解析消息失敗: {e}")
    
    def on_error(self, ws, error):
        """處理錯誤"""
        print(f"❌ WebSocket 錯誤: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        """處理連接關閉"""
        print(f"🔌 WebSocket 連接關閉: {close_status_code} - {close_msg}")
        self.connected = False
    
    def on_open(self, ws):
        """處理連接打開"""
        print("✅ WebSocket 連接成功")
        self.connected = True
        
        # 發送測試消息
        self.send_test_message()
    
    def send_test_message(self):
        """發送測試消息"""
        if not self.connected:
            return
            
        # 發送前端日誌消息
        log_message = {
            "type": "log",
            "data": {
                "level": "info",
                "message": "Python 測試客戶端連接",
                "data": {"test": True},
                "source": "PythonTest",
                "url": "http://localhost:3000/",
                "timestamp": int(time.time() * 1000)
            }
        }
        
        print("📤 發送測試日誌消息...")
        self.ws.send(json.dumps(log_message))
        
        # 發送套利監控請求
        arbitrage_message = {
            "type": "subscribeArbitrage",
            "data": {
                "symbols": ["BTCUSDT", "ETHUSDT"],
                "exchanges": ["bybit", "binance"]
            }
        }
        
        print("📤 發送套利監控請求...")
        self.ws.send(json.dumps(arbitrage_message))
    
    def connect(self):
        """連接 WebSocket"""
        print(f"🔌 正在連接到 {self.url}...")
        
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        # 在單獨線程中運行
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()
        
        return wst
    
    def send_message(self, message):
        """發送消息"""
        if self.connected and self.ws:
            self.ws.send(json.dumps(message))
        else:
            print("❌ WebSocket 未連接")
    
    def disconnect(self):
        """斷開連接"""
        if self.ws:
            self.ws.close()
            self.connected = False

def main():
    """主函數"""
    print("🌐 WebSocket 測試客戶端")
    print("=" * 40)
    
    tester = WebSocketTester()
    
    try:
        # 連接 WebSocket
        thread = tester.connect()
        
        # 等待連接建立
        time.sleep(2)
        
        if tester.connected:
            print("\n🔄 開始測試...")
            
            # 定期發送測試消息
            for i in range(10):
                if not tester.connected:
                    break
                    
                print(f"\n--- 第 {i+1} 次測試 ---")
                
                # 發送心跳消息
                heartbeat = {
                    "type": "ping",
                    "data": {"timestamp": int(time.time() * 1000)}
                }
                tester.send_message(heartbeat)
                
                time.sleep(3)
            
            print("\n✅ 測試完成")
        else:
            print("❌ 無法連接到 WebSocket")
    
    except KeyboardInterrupt:
        print("\n\n⏹️ 測試被用戶中斷")
    except Exception as e:
        print(f"\n❌ 測試過程中發生錯誤: {e}")
    finally:
        tester.disconnect()
        print("👋 再見！")

if __name__ == "__main__":
    main()
