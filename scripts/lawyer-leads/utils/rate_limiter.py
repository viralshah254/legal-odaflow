"""Token-bucket rate limiter per domain."""

from __future__ import annotations

import asyncio
import time
from urllib.parse import urlparse


class RateLimiter:
    def __init__(self, requests_per_second: float = 1.5) -> None:
        self._interval = 1.0 / max(requests_per_second, 0.1)
        self._last: dict[str, float] = {}
        self._lock = asyncio.Lock()

    def _domain(self, url: str) -> str:
        try:
            return urlparse(url).netloc or "default"
        except Exception:
            return "default"

    async def wait(self, url: str) -> None:
        domain = self._domain(url)
        async with self._lock:
            now = time.monotonic()
            last = self._last.get(domain, 0.0)
            delay = self._interval - (now - last)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last[domain] = time.monotonic()
