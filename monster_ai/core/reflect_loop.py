"""Generate → validate → reflect loop (Phase B)."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

GenerateFn = Callable[[], Awaitable[str]]
ValidateFn = Callable[[str], Awaitable[tuple[bool, dict[str, Any]]]]
ReflectFn = Callable[[str, dict[str, Any], int], Awaitable[str]]


@dataclass
class ReflectLoopResult:
    output: str
    passed: bool
    attempts: int
    reports: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "output": self.output,
            "passed": self.passed,
            "attempts": self.attempts,
            "reports": self.reports,
        }


async def run_reflect_loop(
    *,
    generate: GenerateFn,
    validate: ValidateFn,
    reflect: ReflectFn | None = None,
    max_retries: int = 2,
    context: dict[str, Any] | None = None,
) -> ReflectLoopResult:
    """LangGraph-style generate → check → reflect cycle."""
    ctx = context or {}
    reports: list[dict[str, Any]] = []
    current_prompt = ctx.get("user_message", "")
    output = ""

    for attempt in range(max_retries + 1):
        output = await generate()
        ok, report = await validate(output)
        report = {**report, "attempt": attempt}
        reports.append(report)
        if ok:
            return ReflectLoopResult(output=output, passed=True, attempts=attempt + 1, reports=reports)
        if attempt >= max_retries or reflect is None:
            break
        logger.info("Reflect loop attempt %s failed: %s", attempt, report.get("reasons"))
        current_prompt = await reflect(output, report, attempt)
        ctx["user_message"] = current_prompt

    return ReflectLoopResult(output=output, passed=False, attempts=len(reports), reports=reports)