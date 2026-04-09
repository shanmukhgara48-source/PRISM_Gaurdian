<<<<<<< HEAD
import asyncio
import logging
import sys
=======
from dotenv import load_dotenv

load_dotenv()
>>>>>>> 2e70c2b (PRISM Guardian AI full system (local LLM + pipeline))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

<<<<<<< HEAD
from router import router

# ── Windows event-loop compatibility ─────────────────────────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PRISM Guardian — Repo Scanner",
    version="1.0.0",
    description="Minimal, stable, debuggable repo scanning backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten in production
=======
from app.routers import scan, stream, pr_review

app = FastAPI(title="PRISM Guardian AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
>>>>>>> 2e70c2b (PRISM Guardian AI full system (local LLM + pipeline))
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< HEAD
app.include_router(router)
=======
app.include_router(scan.router)
app.include_router(stream.router)
app.include_router(pr_review.router)
>>>>>>> 2e70c2b (PRISM Guardian AI full system (local LLM + pipeline))


@app.get("/health")
async def health():
<<<<<<< HEAD
    return {"status": "ok"}


# ── Entrypoint ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
=======
    return {"status": "ok", "service": "PRISM Guardian AI"}
>>>>>>> 2e70c2b (PRISM Guardian AI full system (local LLM + pipeline))
