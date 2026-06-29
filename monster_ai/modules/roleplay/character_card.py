"""SillyTavern-style character card parsing."""
from __future__ import annotations

import base64
import json
import re
import uuid
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class CharacterCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Character"
    description: str = ""
    personality: str = ""
    scenario: str = ""
    first_mes: str = ""
    mes_example: str = ""
    system_prompt: str = ""
    post_history_instructions: str = ""
    avatar: str | None = None

    def build_system_prompt(self) -> str:
        parts = []
        if self.system_prompt:
            parts.append(self.system_prompt)
        else:
            if self.description:
                parts.append(f"Description: {self.description}")
            if self.personality:
                parts.append(f"Personality: {self.personality}")
            if self.scenario:
                parts.append(f"Scenario: {self.scenario}")
        if self.mes_example:
            parts.append(f"Example dialogue:\n{self.mes_example}")
        if self.post_history_instructions:
            parts.append(self.post_history_instructions)
        return "\n\n".join(parts)


def _normalize_card_data(data: dict[str, Any]) -> dict[str, Any]:
    if "data" in data and isinstance(data["data"], dict):
        data = data["data"]
    spec = data.get("spec") or data.get("spec_version")
    if spec and "name" not in data and "char_name" in data:
        data["name"] = data["char_name"]
    mapping = {
        "char_name": "name",
        "char_persona": "personality",
        "char_greeting": "first_mes",
        "world_scenario": "scenario",
    }
    for old, new in mapping.items():
        if old in data and new not in data:
            data[new] = data[old]
    return data


def parse_card_json(raw: str | bytes | dict[str, Any]) -> CharacterCard:
    if isinstance(raw, dict):
        data = _normalize_card_data(raw)
    else:
        text = raw.decode() if isinstance(raw, bytes) else raw
        data = _normalize_card_data(json.loads(text))
    return CharacterCard.model_validate(data)


def parse_card_png(path: Path) -> CharacterCard:
    from PIL import Image

    with Image.open(path) as img:
        for key in ("chara", "ccv3"):
            if key not in img.info:
                continue
            payload = img.info[key]
            if isinstance(payload, bytes):
                payload = payload.decode("utf-8", errors="ignore")
            try:
                decoded = base64.b64decode(payload).decode("utf-8")
            except Exception:
                decoded = payload
            return parse_card_json(decoded)
    raise ValueError("No character data found in PNG (expected chara/ccv3 metadata)")


def load_card_file(path: Path) -> CharacterCard:
    if path.suffix.lower() == ".png":
        return parse_card_png(path)
    return parse_card_json(path.read_text(encoding="utf-8"))


def save_card(card: CharacterCard, directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^\w\-]+", "_", card.name)[:50] or "character"
    existing = find_card_path(card.id, directory)
    if existing:
        existing.write_text(card.model_dump_json(indent=2), encoding="utf-8")
        return existing
    out = directory / f"{safe}_{card.id[:8]}.json"
    out.write_text(card.model_dump_json(indent=2), encoding="utf-8")
    return out


def find_card_path(card_id: str, directory: Path) -> Path | None:
    if not directory.exists():
        return None
    for path in directory.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("id") == card_id:
                return path
        except (json.JSONDecodeError, OSError):
            continue
    return None