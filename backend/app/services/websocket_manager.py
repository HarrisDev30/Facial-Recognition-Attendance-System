import json

from fastapi import WebSocket

_sessions: dict[str, list[WebSocket]] = {}


async def connect_to_session(session_id: str, websocket: WebSocket):
    await websocket.accept()
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append(websocket)


def disconnect_from_session(session_id: str, websocket: WebSocket):
    if session_id in _sessions:
        _sessions[session_id] = [
            ws for ws in _sessions[session_id] if ws != websocket
        ]
        if not _sessions[session_id]:
            del _sessions[session_id]


async def broadcast_to_session(session_id: str, message: dict):
    if session_id not in _sessions:
        return
    payload = json.dumps(message, default=str)
    stale = []
    for ws in _sessions[session_id]:
        try:
            await ws.send_text(payload)
        except Exception:
            stale.append(ws)
    for ws in stale:
        disconnect_from_session(session_id, ws)
