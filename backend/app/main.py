from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .engine import Engine
from .models import StatusBody, WsMessage

engine = Engine()
clients: Set[WebSocket] = set()
lock = asyncio.Lock()


async def broadcast(message: dict) -> None:
    dead: list[WebSocket] = []
    for ws in list(clients):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)


async def loop() -> None:
    while True:
        await asyncio.sleep(1.0)
        async with lock:
            alert = engine.tick()
            snap = engine.snapshot()
            payload = WsMessage(
                type="tick",
                patients=snap.patients,
                alerts=snap.alerts,
                pipeline=snap.pipeline,
            ).model_dump()
            extra = None
            if alert is not None:
                extra = WsMessage(type="alert", alert=alert).model_dump()
        await broadcast(payload)
        if extra:
            await broadcast(extra)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="AURA Clinical", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "aura"}


@app.get("/api/snapshot")
def snapshot() -> dict:
    return engine.snapshot().model_dump()


@app.post("/api/reset")
async def reset() -> dict:
    async with lock:
        engine.reset()
        snap = engine.snapshot()
    await broadcast(WsMessage(type="snapshot", snapshot=snap).model_dump())
    return {"ok": True}


@app.post("/api/patients/{patient_id}/crash")
async def crash(patient_id: str) -> dict:
    if patient_id not in engine.patients:
        raise HTTPException(404, "unknown patient")
    async with lock:
        engine.crash(patient_id)
        snap = engine.snapshot()
    await broadcast(WsMessage(type="snapshot", snapshot=snap).model_dump())
    return {"ok": True}


@app.post("/api/alerts/{alert_id}/status")
async def alert_status(alert_id: str, body: StatusBody) -> dict:
    async with lock:
        alert = engine.set_alert_status(alert_id, body.status)
        if alert is None:
            raise HTTPException(404, "unknown task")
        snap = engine.snapshot()
    await broadcast(WsMessage(type="snapshot", snapshot=snap).model_dump())
    return alert.model_dump()


@app.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()
    clients.add(websocket)
    try:
        await websocket.send_json(
            WsMessage(type="snapshot", snapshot=engine.snapshot()).model_dump()
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(websocket)
