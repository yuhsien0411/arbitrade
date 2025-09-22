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
    
    # 啟動時保持數據持久化，只清空執行狀態
    try:
        # 清空套利引擎的執行狀態，保留監控對配置
        arb_engine.clear_all_data()
        logger.info("arbitrage_engine_execution_data_cleared_on_startup", success=True)
        
        # 導入並清空 TWAP 引擎資料
        from app.services.twap_engine import twap_engine
        twap_engine.clear_all_data()
        logger.info("twap_engine_data_cleared_on_startup", success=True)
        
        # 監控對資料已經在模組載入時從文件恢復，不需要清空
        logger.info("monitoring_data_loaded_from_persistence", success=True)
    except Exception as e:
        logger.error("startup_data_initialization_failed", error=str(e))
    
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
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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


@app.get("/api/config/status")
async def config_status():
    """檢查系統配置狀態"""
    from app.config.env import config
    
    validation_result = config.validate_api_keys()
    
    return {
        "success": True,
        "data": {
            "api_validation": validation_result,
            "exchanges": config.get_all_exchanges_config(),
            "system": {
                "debug": config.DEBUG,
                "log_level": config.LOG_LEVEL
            }
        }
    }


app.include_router(prices_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(monitoring_router, prefix="/api")
app.include_router(twap_router, prefix="/api")
app.include_router(arbitrage_router, prefix="/api")


# WebSocket 連接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.connection_heartbeat: dict[WebSocket, float] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_heartbeat[websocket] = time.time()
        logger.info("websocket_connected", total_connections=len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_heartbeat:
            del self.connection_heartbeat[websocket]
        logger.info("websocket_disconnected", total_connections=len(self.active_connections))

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
            self.connection_heartbeat[websocket] = time.time()
        except Exception as e:
            logger.error("websocket_send_failed", error=str(e))
            await self.disconnect(websocket)

    async def broadcast(self, message: str):
        disconnected_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
                self.connection_heartbeat[connection] = time.time()
            except Exception as e:
                logger.error("websocket_broadcast_failed", error=str(e))
                disconnected_connections.append(connection)
        
        # 清理斷開的連接
        for connection in disconnected_connections:
            await self.disconnect(connection)

    async def cleanup_stale_connections(self):
        """清理過期的連接"""
        current_time = time.time()
        stale_connections = []
        
        for ws, last_heartbeat in self.connection_heartbeat.items():
            if current_time - last_heartbeat > 60:  # 60秒無心跳
                stale_connections.append(ws)
        
        for ws in stale_connections:
            await self.disconnect(ws)
            logger.info("stale_connection_cleaned")

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
