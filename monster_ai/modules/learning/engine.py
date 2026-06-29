"""Learning + reflect orchestration (Phase B/C)."""
from __future__ import annotations

from typing import Any

from monster_ai.config import LearningSettings
from monster_ai.core.reflect_loop import run_reflect_loop
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.modules.learning.feedback import FeedbackCollector
from monster_ai.modules.learning.knowledge import KnowledgeBase
from monster_ai.modules.learning.preferences import PreferenceLearner
from monster_ai.modules.learning.store import LearningStore
from monster_ai.modules.learning.text_quality import evaluate_text_response
from monster_ai.modules.learning.text_refiner import TextRefiner


class LearningEngine:
    name = "learning"

    def __init__(self, settings: LearningSettings, repair: SelfRepairEngine) -> None:
        self.settings = settings
        self.repair = repair
        self.store = LearningStore(settings.data_dir)
        self.feedback = FeedbackCollector(self.store)
        self.preferences = PreferenceLearner(self.store)
        self.knowledge = KnowledgeBase(self.store, repair if settings.knowledge_extraction else None)
        self.refiner = TextRefiner(repair)

    async def health(self) -> dict[str, Any]:
        return {
            "enabled": self.settings.enabled,
            "healthy": True,
            "reflect_enabled": self.settings.reflect_enabled,
            "feedback_enabled": self.settings.feedback_enabled,
        }

    def build_learning_context(self, *, user_id: str, character_id: str | None = None) -> str:
        parts: list[str] = []
        if self.settings.preference_learning and user_id:
            hint = self.preferences.context_hint(user_id)
            if hint:
                parts.append(hint)
        if character_id and self.settings.knowledge_extraction:
            hint = self.knowledge.context_hint(character_id)
            if hint:
                parts.append(hint)
        return "\n\n".join(parts)

    async def generate_with_reflect(
        self,
        *,
        user_message: str,
        system: str,
        user_id: str = "default",
        character_id: str | None = None,
        session_id: str = "",
    ) -> dict[str, Any]:
        ctx_extra = self.build_learning_context(user_id=user_id, character_id=character_id)
        full_system = f"{system}\n\n{ctx_extra}" if ctx_extra else system
        state = {"user_message": user_message, "system": full_system}

        async def _gen() -> str:
            return await self.repair.generate(state["user_message"], system=state["system"])

        async def _validate(output: str) -> tuple[bool, dict[str, Any]]:
            report = evaluate_text_response(
                output,
                user_message=user_message,
                min_score=self.settings.min_quality_score,
            )
            return report.passed, report.to_dict()

        async def _reflect(output: str, report: dict[str, Any], attempt: int) -> str:
            improved = await self.refiner.reflect(
                user_message=user_message,
                failed_output=output,
                report=report,
                system=full_system,
            )
            state["user_message"] = (
                f"{user_message}\n\n[Quality retry {attempt + 1}: improve relevance and depth]"
            )
            return improved

        if not self.settings.reflect_enabled:
            content = await _gen()
            result_passed = True
            attempts = 1
            reports: list[dict[str, Any]] = []
        else:
            loop = await run_reflect_loop(
                generate=_gen,
                validate=_validate,
                reflect=_reflect,
                max_retries=self.settings.reflect_max_retries,
                context=state,
            )
            content = loop.output
            result_passed = loop.passed
            attempts = loop.attempts
            reports = loop.reports
            if not result_passed:
                self.store.append_jsonl(
                    self.store.failures_log,
                    {
                        "user_id": user_id,
                        "session_id": session_id,
                        "character_id": character_id,
                        "reports": reports,
                    },
                )

        if self.settings.knowledge_extraction and character_id:
            await self.knowledge.extract_from_turn(character_id, user_message, content)

        return {
            "content": content,
            "backend": self.repair.state.active_backend,
            "quality": {
                "passed": result_passed,
                "attempts": attempts,
                "reports": reports,
            },
        }

    def record_feedback(
        self,
        *,
        user_id: str,
        session_id: str,
        rating: int | None = None,
        thumbs: str | None = None,
        comment: str = "",
        message: str = "",
    ) -> dict[str, Any]:
        if not self.settings.feedback_enabled:
            return {"ok": False, "message": "feedback disabled"}
        topics = self.preferences.extract_topics(message) if message else []
        rec = self.feedback.record(
            user_id=user_id,
            session_id=session_id,
            rating=rating,
            thumbs=thumbs,
            comment=comment,
            extra={"topics": topics},
        )
        if self.settings.preference_learning:
            self.preferences.update_from_feedback(
                user_id,
                rating=rating,
                thumbs=thumbs,
                topics=topics,
                session_id=session_id,
            )
        return {"ok": True, "record": rec}