from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
import json

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.logger import configure_logging, get_logger
from app.api.routes_prices import router as prices_router
from app.api.routes_settings import router as settings_router
from app.api.routes_monitoring import router as monitoring_router
from app.api.routes_twap import router as twap_router
from app.api.routes_arbitrage import router as arbitrage_router
from app.services.arbitrage_engine import arb_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger = get_logger()
    logger.info("service_start", success=True)
    
    # 重新啟動時清空所有資料
    try:
        # 清空套利引擎資料
        arb_engine.clear_all_data()
        logger.info("arbitrage_engine_data_cleared_on_startup", success=True)
        
        # 導入並清空 TWAP 引擎資料
        from app.services.twap_engine import twap_engine
        twap_engine.clear_all_data()
        logger.info("twap_engine_data_cleared_on_startup", success=True)
        
        # 清空監控對資料
        from app.api.routes_monitoring import clear_monitoring_data
        clear_monitoring_data()
        logger.info("monitoring_data_cleared_on_startup", success=True)
    except Exception as e:
        logger.error("clear_data_failed_on_startup", error=str(e))
    
    # 啟動套利引擎
    await arb_engine.start()
    logger.info("arbitrage_engine_started", success=True)
    
    try:
        yield
    finally:
        # 停止套利引擎
        await arb_engine.stop()
        logger.info("arbitrage_engine_stopped", success=True)
        logger.info("service_stop", success=True)


app = FastAPI(title="Arbitrage Python Backend", lifespan=lifespan)

# 添加 CORS 中間件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = get_logger()


@app.get("/health")
async def health():
    start = time.perf_counter()
    response = {"success": True, "data": {"status": "ok"}}
    latency_ms = (time.perf_counter() - start) * 1000.0
    logger.info("health_check", success=True, latency_ms=round(latency_ms, 2))
    return response


app.include_router(prices_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(monitoring_router, prefix="/api")
app.include_router(twap_router, prefix="/api")
app.include_router(arbitrage_router, prefix="/api")


# WebSocket 連接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # 移除斷開的連接
                self.active_connections.remove(connection)

manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    logger.info("websocket_connected", success=True)
    
    try:
        while True:
            # 保持連接活躍
            data = await websocket.receive_text()
            # 可以處理客戶端發送的消息
            logger.info("websocket_message", message=data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("websocket_disconnected", success=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7000, reload=True)
