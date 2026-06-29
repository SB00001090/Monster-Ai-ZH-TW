"""Multi-character roleplay session persistence."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from monster_ai.modules.roleplay.character_card import CharacterCard


class RoleplaySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "New Session"
    active_character_id: str | None = None
    participant_ids: list[str] = Field(default_factory=list)
    messages: list[dict[str, Any]] = Field(default_factory=list)
    memory_summary: str = ""
    message_count: int = 0
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class SessionStore:
    def __init__(self, chats_dir: Path) -> None:
        self.chats_dir = chats_dir
        self.chats_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, session_id: str) -> Path:
        return self.chats_dir / f"{session_id}.json"

    def list_sessions(self) -> list[dict[str, Any]]:
        sessions = []
        for path in sorted(self.chats_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                sessions.append({
                    "id": data.get("id", path.stem),
                    "title": data.get("title", path.stem),
                    "message_count": data.get("message_count", 0),
                    "updated_at": data.get("updated_at"),
                })
            except (json.JSONDecodeError, OSError):
                continue
        return sessions

    def load(self, session_id: str) -> RoleplaySession | None:
        path = self._path(session_id)
        if not path.exists():
            return None
        return RoleplaySession.model_validate(json.loads(path.read_text(encoding="utf-8")))

    def save(self, session: RoleplaySession) -> None:
        session.updated_at = datetime.now(timezone.utc).isoformat()
        self._path(session.id).write_text(
            session.model_dump_json(indent=2),
            encoding="utf-8",
        )

    def create(self, title: str = "New Session", character: CharacterCard | None = None) -> RoleplaySession:
        session = RoleplaySession(title=title)
        if character:
            session.participant_ids = [character.id]
            session.active_character_id = character.id
            if character.first_mes:
                session.messages.append({
                    "role": "assistant",
                    "character_id": character.id,
                    "character_name": character.name,
                    "content": character.first_mes,
                })
        self.save(session)
        return session