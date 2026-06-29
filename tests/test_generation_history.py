"""Tests for generation history."""
from __future__ import annotations

from monster_ai.config import HistorySettings
from monster_ai.core.generation_history import GenerationHistory


def test_record_and_list(tmp_path) -> None:
    settings = HistorySettings(dir=str(tmp_path / "history"))
    history = GenerationHistory(settings)
    job_id = history.record("image", {"prompt": "cyberpunk cat", "path": "/tmp/x.png"})
    assert job_id
    rows = history.list_entries(query="cyberpunk", job_type="image")
    assert len(rows) == 1
    assert rows[0]["prompt"] == "cyberpunk cat"


def test_get_entry(tmp_path) -> None:
    settings = HistorySettings(dir=str(tmp_path / "history"))
    history = GenerationHistory(settings)
    job_id = history.record("video", {"prompt": "ocean waves", "fps": 8})
    entry = history.get_entry(job_id)
    assert entry is not None
    assert entry["type"] == "video"