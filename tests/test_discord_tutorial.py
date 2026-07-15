"""Tests for MonsterGuard questionnaire tutorial."""
from __future__ import annotations

from monster_ai.modules.discord.guard.tutorial_content import (
    QUESTIONNAIRE,
    get_question,
    question_count,
)


def test_questionnaire_has_multiple_questions() -> None:
    assert question_count() >= 4
    assert len(QUESTIONNAIRE) == question_count()


def test_questions_have_options() -> None:
    for i, q in enumerate(QUESTIONNAIRE):
        assert q.key
        assert q.title
        assert q.prompt
        assert len(q.options) >= 2
        assert get_question(i).key == q.key
        for opt in q.options:
            assert opt.value in q.replies


def test_get_question_clamps() -> None:
    assert get_question(-1).key == QUESTIONNAIRE[0].key
    assert get_question(999).key == QUESTIONNAIRE[-1].key


def test_mentions_setup() -> None:
    blob = "\n".join(q.prompt + str(q.replies) for q in QUESTIONNAIRE)
    assert "/guard setup" in blob or "guard setup" in blob
