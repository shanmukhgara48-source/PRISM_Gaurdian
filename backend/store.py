import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ScanState:
    scan_id: str
    repo_url: str
    status: str = "running"   # running | completed | error
    result: Optional[dict] = None
    error: Optional[dict] = None
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    done: bool = False

    def finalize(
        self,
        result: Optional[dict] = None,
        error: Optional[dict] = None,
    ) -> None:
        """
        Mark the scan as permanently finished.
        Exactly one of result/error should be supplied.
        Always sets done=True — safe to call multiple times.
        """
        if error is not None:
            self.status = "error"
            self.error  = error
        else:
            self.status = "completed"
            self.result = result
        self.done = True


# In-memory store: scan_id -> ScanState
_store: dict[str, ScanState] = {}


def create_scan(repo_url: str) -> str:
    scan_id = str(uuid.uuid4())
    _store[scan_id] = ScanState(scan_id=scan_id, repo_url=repo_url)
    return scan_id


def get_scan(scan_id: str) -> Optional[ScanState]:
    return _store.get(scan_id)


def all_scans() -> dict[str, ScanState]:
    return _store
