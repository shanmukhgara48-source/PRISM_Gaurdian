import asyncio
import json
import logging
import traceback

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from orchestrator import run_pipeline
from store import create_scan, get_scan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ── Request / Response models ─────────────────────────────────────────────────

class ScanRequest(BaseModel):
    repo_url: str


def _safe_json(data: object) -> str:
    """JSON-serialize data — never raises. Falls back to default=str, then to error stub."""
    try:
        return json.dumps(data, default=str)
    except Exception:
        try:
            return json.dumps({"error": "serialization failed", "repr": repr(data)[:200]})
        except Exception:
            return '{"error": "serialization failed completely"}'


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/scan", status_code=202)
async def start_scan(body: ScanRequest):
    """
    Kick off a background pipeline scan.
    Returns immediately with a scan_id.
    """
    scan_id = create_scan(body.repo_url)
    asyncio.create_task(run_pipeline(scan_id, body.repo_url))
    logger.info("scan started  scan_id=%s  repo=%s", scan_id, body.repo_url)
    return {"scan_id": scan_id}


@router.get("/scan/{scan_id}")
async def get_scan_status(scan_id: str):
    """
    Poll the current status of a scan.
    Returns result when completed, error details when failed.
    """
    scan = get_scan(scan_id)
    if scan is None:
        raise HTTPException(
            status_code=404,
            detail={"type": "NotFound", "message": f"scan_id '{scan_id}' does not exist"},
        )

    response: dict = {"scan_id": scan_id, "status": scan.status}

    if scan.status == "completed":
        response["result"] = scan.result
    elif scan.status == "error":
        response["error"] = scan.error

    return response


@router.get("/stream/{scan_id}")
async def stream_scan(scan_id: str):
    """
    Server-Sent Events stream for a scan.
    Hardened: never crashes, never exits before "done", always serializes safely.
    """
    scan = get_scan(scan_id)
    if scan is None:
        raise HTTPException(
            status_code=404,
            detail={"type": "NotFound", "message": f"scan_id '{scan_id}' does not exist"},
        )

    async def event_generator():
        done_sent = False

        try:
            while True:
                # ── Drain queue with timeout ───────────────────────────────────
                try:
                    raw_event = await asyncio.wait_for(scan.queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    if scan.done and scan.queue.empty():
                        # Pipeline finished and queue is fully drained
                        logger.info("[stream] pipeline done, queue empty — closing")
                        break
                    # Still running or items pending — heartbeat to stay alive
                    yield "event: heartbeat\ndata: {}\n\n"
                    continue
                except asyncio.CancelledError:
                    logger.info("[stream] generator cancelled (client disconnected)")
                    raise

                # ── Validate event is a dict ───────────────────────────────────
                if not isinstance(raw_event, dict):
                    logger.warning("[stream] non-dict event dropped: %r", raw_event)
                    continue

                event_type: str = str(raw_event.get("event") or "message")
                event_data: object = raw_event.get("data") or {}

                logger.info("[stream] sending event: %s", event_type)

                data_str = _safe_json(event_data)
                yield f"event: {event_type}\ndata: {data_str}\n\n"

                if event_type == "done":
                    done_sent = True
                    # Small delay so the browser flushes the event before we close
                    await asyncio.sleep(0.5)
                    break

                if event_type == "error":
                    # Fatal pipeline error — send a "done" wrapper so frontend
                    # always reaches a terminal state, then close
                    if not done_sent:
                        done_sent = True
                        done_payload = _safe_json({"status": "error", "message": "Pipeline failed"})
                        yield f"event: done\ndata: {done_payload}\n\n"
                        await asyncio.sleep(0.5)
                    break

        except asyncio.CancelledError:
            raise  # client disconnected — propagate, don't emit anything

        except Exception as exc:
            # ── SSE generator crash — last-resort recovery ─────────────────────
            tb = traceback.format_exc()
            logger.error("[stream] SSE CRASH:\n%s", tb)

            try:
                error_payload = _safe_json({
                    "type":      type(exc).__name__,
                    "message":   str(exc),
                    "traceback": tb,
                })
                yield f"event: error\ndata: {error_payload}\n\n"
            except Exception:
                yield 'event: error\ndata: {"error": "unknown SSE crash"}\n\n'

            # Always send "done" so the frontend terminates cleanly
            if not done_sent:
                try:
                    done_payload = _safe_json({"status": "error", "message": str(exc)})
                    yield f"event: done\ndata: {done_payload}\n\n"
                except Exception:
                    yield 'event: done\ndata: {"status": "error"}\n\n'

        finally:
            logger.info("[stream] event_generator exiting  done_sent=%s", done_sent)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",    # disable nginx buffering
            "Connection":       "keep-alive",
        },
    )
