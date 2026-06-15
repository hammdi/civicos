"""In-process WebSocket fan-out manager.

Clients subscribe to a named channel (e.g. ``queue:12`` or ``file:REF-2024-001``)
and receive JSON broadcasts whenever that channel's state changes. This keeps
the queue board, document tracker and issue map live without polling.

For a single backend replica an in-memory registry is sufficient and has zero
operational cost. To scale horizontally, swap ``broadcast`` for a Redis
pub/sub publish — the public surface stays identical.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("civicos.ws")


class ConnectionManager:
    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()
        # The main event loop, captured at app startup. Sync request handlers
        # run in a threadpool with no loop of their own, so they schedule
        # broadcasts back onto this loop (where the WebSockets actually live).
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._channels[channel].add(websocket)
        logger.info("WS connect channel=%s (total=%d)", channel, len(self._channels[channel]))

    async def disconnect(self, channel: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._channels.get(channel, set()).discard(websocket)
            if not self._channels.get(channel):
                self._channels.pop(channel, None)
        logger.info("WS disconnect channel=%s", channel)

    async def broadcast(self, channel: str, message: dict[str, Any]) -> None:
        """Send ``message`` (JSON-serialisable) to every subscriber of ``channel``."""
        async with self._lock:
            targets = list(self._channels.get(channel, set()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 — client vanished mid-send
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._channels.get(channel, set()).discard(ws)

    def broadcast_sync(self, channel: str, message: dict[str, Any]) -> None:
        """Fire-and-forget broadcast usable from synchronous request handlers.

        FastAPI runs sync endpoints in a worker thread that has no event loop,
        so we schedule the coroutine onto the captured main loop (where the
        WebSocket objects live) using the thread-safe API.
        """
        loop = self._loop
        if loop is not None and loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(channel, message), loop)
            return
        # Fallback (e.g. called from within the loop thread, or before startup).
        try:
            running = asyncio.get_running_loop()
            running.create_task(self.broadcast(channel, message))
        except RuntimeError:
            logger.debug("No event loop available to broadcast on channel=%s", channel)


# Channel name helpers keep the conventions in one place.
def queue_channel(institution_id: int) -> str:
    return f"queue:{institution_id}"


def file_channel(reference: str) -> str:
    return f"file:{reference}"


def issues_channel(city: str | None = None) -> str:
    return f"issues:{city or 'all'}"


manager = ConnectionManager()
