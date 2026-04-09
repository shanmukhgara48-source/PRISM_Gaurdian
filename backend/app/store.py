import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ScanState:
    scan_id: str
    events: List[dict] = field(default_factory=list)
    result: Optional[dict] = None
    done: bool = False
    error: Optional[str] = None
    _listeners: List[asyncio.Queue] = field(default_factory=list)

    def add_event(self, event: dict):
        self.events.append(event)
        for q in list(self._listeners):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._listeners.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._listeners:
            self._listeners.remove(q)


# Global in-memory store
scans: Dict[str, ScanState] = {}
