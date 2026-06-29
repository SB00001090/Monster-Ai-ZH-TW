"""RapidCredentialShield bridge — hardware-bound ephemeral credentials."""
from __future__ import annotations

import hashlib
import json
import logging
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from monster_ai.protection.monsterlock.crypto import derive_key, wipe_bytes

logger = logging.getLogger(__name__)


@dataclass
class CredentialToken:
    token_id: str
    value: str
    issued_at: float
    expires_at: float
    hardware_bound: bool = True

    def is_valid(self, fingerprint: str) -> bool:
        if time.time() > self.expires_at:
            return False
        if self.hardware_bound:
            expected = _bind_token(self.value, fingerprint)
            return secrets.compare_digest(expected, self.token_id)
        return True

    def to_dict(self) -> dict[str, Any]:
        return {
            "token_id": self.token_id[:16] + "…",
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "ttl_seconds": max(0, self.expires_at - time.time()),
            "hardware_bound": self.hardware_bound,
        }


def _bind_token(secret: str, fingerprint: str) -> str:
    return hashlib.sha256(f"{secret}:{fingerprint}".encode()).hexdigest()


@dataclass
class RapidCredentialShield:
    """Rotates credentials every rotation_interval seconds (default 0.1s active window)."""

    fingerprint: str
    rotation_interval: float = 0.1
    token_ttl: float = 0.5
    store_path: Path = field(default_factory=lambda: Path("./data/logs/security/credentials.json"))
    _current: CredentialToken | None = field(default=None, repr=False)
    _generation: int = 0
    _signing_key: bytes | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        dk = derive_key(self.fingerprint, info=b"rapid-credential-shield")
        self._signing_key = dk.key
        dk.wipe()
        self.store_path.parent.mkdir(parents=True, exist_ok=True)

    def rotate(self) -> CredentialToken:
        self._generation += 1
        secret = secrets.token_urlsafe(32)
        now = time.time()
        token = CredentialToken(
            token_id=_bind_token(secret, self.fingerprint),
            value=secret,
            issued_at=now,
            expires_at=now + self.token_ttl,
            hardware_bound=True,
        )
        self._current = token
        self._persist_state()
        return token

    def current(self) -> CredentialToken | None:
        if self._current is None:
            return self.rotate()
        if not self._current.is_valid(self.fingerprint):
            return self.rotate()
        return self._current

    def verify(self, token_id: str) -> bool:
        tok = self.current()
        if tok is None:
            return False
        if time.time() > tok.expires_at:
            return False
        return secrets.compare_digest(tok.token_id, token_id)

    def _persist_state(self) -> None:
        if self._current is None:
            return
        record = {
            "generation": self._generation,
            "issued_at": self._current.issued_at,
            "expires_at": self._current.expires_at,
            "fingerprint_prefix": self.fingerprint[:12],
            "rotations": self._generation,
        }
        try:
            self.store_path.write_text(json.dumps(record, indent=2), encoding="utf-8")
        except OSError as exc:
            logger.warning("Credential state write failed: %s", exc)

    def to_dict(self) -> dict[str, Any]:
        tok = self.current()
        return {
            "rotation_interval": self.rotation_interval,
            "token_ttl": self.token_ttl,
            "generation": self._generation,
            "current": tok.to_dict() if tok else None,
        }

    def wipe(self) -> None:
        if self._signing_key:
            wipe_bytes(self._signing_key)
            self._signing_key = None