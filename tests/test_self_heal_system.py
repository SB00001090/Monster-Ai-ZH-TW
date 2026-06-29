"""Tests for self-heal orchestrator + learning reflect loop."""
from __future__ import annotations

import pytest

from monster_ai.config import LearningSettings, OrchestratorSettings
from monster_ai.core.reflect_loop import run_reflect_loop
from monster_ai.modules.learning.preferences import PreferenceLearner
from monster_ai.modules.learning.store import LearningStore
from monster_ai.modules.learning.text_quality import evaluate_text_response


@pytest.mark.asyncio
async def test_reflect_loop_passes_on_good_output() -> None:
    async def gen() -> str:
        return "This is a helpful detailed answer about anime and gaming for the user."

    async def validate(output: str) -> tuple[bool, dict]:
        r = evaluate_text_response(output, user_message="tell me about anime", min_score=0.4)
        return r.passed, r.to_dict()

    result = await run_reflect_loop(generate=gen, validate=validate, max_retries=1)
    assert result.passed
    assert result.attempts == 1


@pytest.mark.asyncio
async def test_reflect_loop_retries_then_passes() -> None:
    calls = {"n": 0}

    async def gen() -> str:
        calls["n"] += 1
        if calls["n"] == 1:
            return "ok"
        return "A longer thoughtful answer about Python coding and APIs for your question."

    async def validate(output: str) -> tuple[bool, dict]:
        r = evaluate_text_response(output, user_message="explain python api", min_score=0.55)
        return r.passed, r.to_dict()

    async def reflect(output: str, report: dict, attempt: int) -> str:
        return output

    result = await run_reflect_loop(
        generate=gen, validate=validate, reflect=reflect, max_retries=2
    )
    assert result.passed
    assert result.attempts == 2


def test_preference_learning_from_feedback(tmp_path) -> None:
    store = LearningStore(tmp_path)
    learner = PreferenceLearner(store)
    model = learner.update_from_feedback(
        "user1",
        rating=5,
        thumbs="up",
        topics=["anime"],
        session_id="s1",
    )
    assert model["satisfactionScore"] >= 0.75
    assert model["preferences"]["topicPreferences"].get("anime", 0) > 0.5


def test_orchestrator_defaults() -> None:
    o = OrchestratorSettings()
    assert o.enabled
    assert o.check_discord
    assert o.auto_recover_monsterlock


def test_learning_settings_defaults() -> None:
    l = LearningSettings()
    assert l.reflect_enabled
    assert l.feedback_enabled