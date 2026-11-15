import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request


class RateLimiter:
    """Sliding-window limit per client IP, used as a FastAPI dependency.

    shortcut: in-memory and per-process; move to a shared store (e.g. Redis) when running several workers.
    """

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self._window:
                hits.popleft()
            if len(hits) >= self._max:
                raise HTTPException(429, "Too many requests — please try again later")
            hits.append(now)
