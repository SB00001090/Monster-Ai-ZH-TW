"""Serialize GPU-heavy jobs to avoid VRAM contention on 8GB cards."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator


class VramGuard:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._holder: str | None = None

    @property
    def busy(self) -> bool:
        return self._lock.locked()

    @property
    def current_job(self) -> str | None:
        return self._holder

    @asynccontextmanager
    async def acquire(self, job_name: str) -> AsyncIterator[None]:
        await self._lock.acquire()
        self._holder = job_name
        try:
            yield
        finally:
            self._holder = None
            self._lock.release()