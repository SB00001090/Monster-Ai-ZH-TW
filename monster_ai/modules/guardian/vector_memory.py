"""Long-term character memory — local vector store with encrypted persistence."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from monster_ai.modules.guardian.crypto import EncryptedBlob, decrypt_payload, derive_user_key, encrypt_payload

EMBED_DIM = 256


def _embed_text(text: str, dim: int = EMBED_DIM) -> np.ndarray:
    """Deterministic local embedding — no external API."""
    vec = np.zeros(dim, dtype=np.float32)
    for token in text.lower().split():
        digest = hashlib.sha256(token.encode()).digest()
        for i, byte in enumerate(digest):
            vec[i % dim] += (byte - 128) / 128.0
    norm = float(np.linalg.norm(vec))
    return vec / norm if norm > 0 else vec


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 0:
        return 0.0
    return float(np.dot(a, b) / denom)


class VectorMemoryStore:
    def __init__(self, data_dir: Path) -> None:
        self.root = data_dir / "vector_memory"
        self.root.mkdir(parents=True, exist_ok=True)

    def _char_dir(self, character_id: str) -> Path:
        safe = hashlib.sha256(character_id.encode()).hexdigest()[:16]
        path = self.root / safe
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _vault_key(self, character_id: str, vault_passphrase: str) -> bytes:
        salt = hashlib.sha256(f"guardian-memory:{character_id}".encode()).digest()[:16]
        return derive_user_key(vault_passphrase, salt, info=b"guardian-memory-v1")

    def _store_path(self, character_id: str) -> Path:
        return self._char_dir(character_id) / "memories.mgvault"

    def _load_entries(self, character_id: str, vault_passphrase: str) -> list[dict[str, Any]]:
        path = self._store_path(character_id)
        if not path.is_file():
            return []
        key = self._vault_key(character_id, vault_passphrase)
        raw = json.loads(path.read_text(encoding="utf-8"))
        blob = EncryptedBlob.from_dict(raw)
        data = decrypt_payload(blob, key)
        if isinstance(data, list):
            return [e for e in data if isinstance(e, dict)]
        return []

    def _save_entries(
        self,
        character_id: str,
        vault_passphrase: str,
        entries: list[dict[str, Any]],
    ) -> None:
        key = self._vault_key(character_id, vault_passphrase)
        blob = encrypt_payload(entries, key)
        self._store_path(character_id).write_text(
            json.dumps(blob.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def remember(
        self,
        character_id: str,
        *,
        text: str,
        vault_passphrase: str,
        role: str = "assistant",
        session_id: str | None = None,
        importance: float = 0.5,
    ) -> dict[str, Any]:
        if len(vault_passphrase) < 8:
            return {"ok": False, "reason": "vault_key_too_short"}
        if not text.strip():
            return {"ok": False, "reason": "empty_text"}

        entries = self._load_entries(character_id, vault_passphrase)
        embedding = _embed_text(text).tolist()
        entry = {
            "id": hashlib.sha256(f"{character_id}:{text}:{len(entries)}".encode()).hexdigest()[:16],
            "text": text.strip()[:2000],
            "role": role,
            "session_id": session_id,
            "importance": max(0.0, min(1.0, importance)),
            "embedding": embedding,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        entries.append(entry)
        entries = entries[-500:]
        self._save_entries(character_id, vault_passphrase, entries)
        return {"ok": True, "memory_id": entry["id"], "total": len(entries)}

    def recall(
        self,
        character_id: str,
        *,
        query: str,
        vault_passphrase: str,
        top_k: int = 5,
    ) -> dict[str, Any]:
        if len(vault_passphrase) < 8:
            return {"ok": False, "reason": "vault_key_too_short", "memories": []}
        entries = self._load_entries(character_id, vault_passphrase)
        if not entries:
            return {"ok": True, "memories": [], "total": 0}

        q_vec = _embed_text(query)
        scored: list[tuple[float, dict[str, Any]]] = []
        for entry in entries:
            emb = entry.get("embedding")
            if not isinstance(emb, list):
                continue
            vec = np.array(emb, dtype=np.float32)
            score = _cosine(q_vec, vec) + float(entry.get("importance", 0.5)) * 0.1
            scored.append((score, entry))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = [
            {
                "id": e.get("id"),
                "text": e.get("text"),
                "role": e.get("role"),
                "score": round(s, 4),
                "created_at": e.get("created_at"),
            }
            for s, e in scored[: max(1, top_k)]
        ]
        return {"ok": True, "memories": top, "total": len(entries)}

    def list_memories(
        self,
        character_id: str,
        *,
        vault_passphrase: str,
        limit: int = 20,
    ) -> dict[str, Any]:
        entries = self._load_entries(character_id, vault_passphrase)
        items = [
            {
                "id": e.get("id"),
                "text": e.get("text"),
                "role": e.get("role"),
                "created_at": e.get("created_at"),
            }
            for e in entries[-limit:]
        ]
        return {"ok": True, "memories": items, "total": len(entries)}