"""Basic self-protection: rate limits and safe paths."""
from __future__ import annotations

import time
from collections import defaultdict, deque
from pathlib import Path


class RateLimiter:
    def __init__(self, max_per_minute: int = 60) -> None:
        self.max_per_minute = max_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        window = self._hits[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self.max_per_minute:
            return False
        window.append(now)
        return True


def is_safe_path(path: str | Path, allowed_roots: list[str]) -> bool:
    """Return True if resolved path stays inside allowed roots."""
    try:
        resolved = Path(path).resolve()
        for root in allowed_roots:
            root_path = Path(root).resolve()
            resolved.relative_to(root_path)
            return True
    except ValueError:
        return False
    return False