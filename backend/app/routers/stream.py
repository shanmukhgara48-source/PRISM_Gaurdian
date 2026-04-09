import asyncio
import json

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.store import scans

router = APIRouter(prefix="/api")


@router.get("/stream/{scan_id}")
async def stream_scan(scan_id: str):
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")

    state = scans[scan_id]

    async def event_generator():
        # Replay all events published so far
        for event in list(state.events):
            yield {"data": json.dumps(event)}
            await asyncio.sleep(0)

        if state.done:
            return

        # Subscribe to future events
        queue = state.subscribe()
        try:
            while not state.done:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield {"data": json.dumps(event)}
                    if event.get("event") in ("done", "error"):
                        break
                except asyncio.TimeoutError:
                    yield {"data": json.dumps({"event": "ping"})}
        finally:
            state.unsubscribe(queue)

    return EventSourceResponse(event_generator())
