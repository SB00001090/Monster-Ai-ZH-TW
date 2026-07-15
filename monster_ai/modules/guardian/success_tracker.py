"""Guardian Ai generation success metrics — 98% target by 2026/09/01."""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

TARGET_SUCCESS_RATE = 0.98
TARGET_LIKENESS_SIMILARITY = 0.98
TARGET_DEADLINE = "2026-09-01"


class GuardianSuccessTracker:
    def __init__(self, data_dir: Path) -> None:
        self.root = data_dir / "generation_success"
        self.root.mkdir(parents=True, exist_ok=True)
        self.metrics_path = self.root / "metrics.jsonl"
        self.summary_path = self.root / "summary.json"

    def record(
        self,
        *,
        ok: bool,
        backend: str = "unknown",
        quality_score: float | None = None,
        likeness_score: float | None = None,
        guardian_gate_passed: bool | None = None,
        issues: list[str] | None = None,
        repair_attempts: int = 0,
        character_id: str | None = None,
    ) -> None:
        row = {
            "ts": time.time(),
            "ok": ok,
            "backend": backend,
            "quality_score": quality_score,
            "likeness_score": likeness_score,
            "guardian_gate_passed": guardian_gate_passed,
            "issues": issues or [],
            "repair_attempts": repair_attempts,
            "character_id": character_id,
        }
        with self.metrics_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        self._refresh_summary()

    def _refresh_summary(self) -> None:
        if not self.metrics_path.is_file():
            return
        lines = self.metrics_path.read_text(encoding="utf-8").strip().splitlines()
        total = len(lines)
        if total == 0:
            return

        successes = 0
        scores: list[float] = []
        sim_scores: list[float] = []
        by_backend: dict[str, dict[str, int]] = {}
        for ln in lines[-500:]:
            try:
                row = json.loads(ln)
            except json.JSONDecodeError:
                continue
            backend = str(row.get("backend", "unknown"))
            bucket = by_backend.setdefault(backend, {"ok": 0, "total": 0})
            bucket["total"] += 1
            if row.get("ok"):
                successes += 1
                bucket["ok"] += 1
            qs = row.get("quality_score")
            if isinstance(qs, (int, float)):
                scores.append(float(qs))
            ss = row.get("likeness_score")
            if isinstance(ss, (int, float)):
                sim_scores.append(float(ss))

        window = min(total, 500)
        rate = successes / window if window else 0.0
        avg_sim = round(sum(sim_scores) / len(sim_scores), 4) if sim_scores else None
        summary = {
            "total_recorded": total,
            "window_size": window,
            "success_rate": round(rate, 4),
            "target_rate": TARGET_SUCCESS_RATE,
            "avg_likeness_similarity": avg_sim,
            "target_likeness": TARGET_LIKENESS_SIMILARITY,
            "likeness_on_track": (avg_sim or 0) >= TARGET_LIKENESS_SIMILARITY,
            "target_deadline": TARGET_DEADLINE,
            "on_track": rate >= TARGET_SUCCESS_RATE,
            "avg_quality_score": round(sum(scores) / len(scores), 3) if scores else None,
            "by_backend": {
                k: {"success_rate": round(v["ok"] / max(v["total"], 1), 4), **v}
                for k, v in by_backend.items()
            },
            "updated_at": time.time(),
        }
        self.summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    def status(self) -> dict[str, Any]:
        if self.summary_path.is_file():
            return json.loads(self.summary_path.read_text(encoding="utf-8"))
        return {
            "total_recorded": 0,
            "success_rate": 0.0,
            "target_rate": TARGET_SUCCESS_RATE,
            "target_deadline": TARGET_DEADLINE,
            "on_track": False,
        }