import asyncio
import json
from typing import List, Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/ws", tags=["websockets"])

class ConnectionManager:
    def __init__(self):
        # Maps connection lists to client types, e.g. "admin", "cashier", "user_12"
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, websocket: WebSocket, client_type: str):
        await websocket.accept()
        self.loop = asyncio.get_running_loop()
        if client_type not in self.active_connections:
            self.active_connections[client_type] = []
        self.active_connections[client_type].append(websocket)

    def disconnect(self, websocket: WebSocket, client_type: str):
        if client_type in self.active_connections:
            if websocket in self.active_connections[client_type]:
                self.active_connections[client_type].remove(websocket)
            if not self.active_connections[client_type]:
                del self.active_connections[client_type]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

    async def broadcast_to_type(self, client_type: str, message: dict):
        if client_type in self.active_connections:
            for connection in self.active_connections[client_type]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    # Connection might be dead
                    pass

    async def broadcast_all(self, message: dict):
        for client_type in list(self.active_connections.keys()):
            await self.broadcast_to_type(client_type, message)

    def broadcast_sync(self, message: dict, client_type: Optional[str] = None):
        """Schedule a websocket broadcast from sync code without blocking."""
        if not self.loop or not self.loop.is_running():
            return

        if client_type is None:
            coro = self.broadcast_all(message)
        else:
            coro = self.broadcast_to_type(client_type, message)

        asyncio.run_coroutine_threadsafe(coro, self.loop)

manager = ConnectionManager()

@router.websocket("/{client_type}")
async def websocket_endpoint(websocket: WebSocket, client_type: str):
    await manager.connect(websocket, client_type)
    try:
        while True:
            # Keep connection alive & receive messages if clients want to push
            data = await websocket.receive_text()
            # Echo back or process commands if any
            try:
                msg_json = json.loads(data)
                # Handle specific websocket actions if needed
                await websocket.send_text(json.dumps({"status": "received", "data": msg_json}))
            except Exception:
                await websocket.send_text(json.dumps({"status": "error", "message": "Invalid JSON"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_type)
