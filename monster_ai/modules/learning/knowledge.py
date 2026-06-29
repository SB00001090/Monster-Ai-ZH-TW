"""Character knowledge accumulation (Phase C)."""
from __future__ import annotations

import re
from typing import Any

from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.modules.learning.store import LearningStore

EXTRACT_SYSTEM = """Extract durable facts about the user from dialogue.
Output JSON only: {"facts":[{"fact":"...","confidence":0.0-1.0}]}"""


class KnowledgeBase:
    def __init__(self, store: LearningStore, repair: SelfRepairEngine | None = None) -> None:
        self.store = store
        self.repair = repair

    def get(self, character_id: str) -> dict[str, Any]:
        default = {
            "characterId": character_id,
            "knowledgeBase": {"facts": [], "preferences": []},
        }
        return self.store.read_json(self.store.knowledge_path(character_id), default)

    async def extract_from_turn(
        self,
        character_id: str,
        user_message: str,
        assistant_reply: str,
    ) -> dict[str, Any]:
        kb = self.get(character_id)
        facts = kb.setdefault("knowledgeBase", {}).setdefault("facts", [])

        if self.repair:
            try:
                raw = await self.repair.generate(
                    f"User: {user_message}\nAssistant: {assistant_reply}",
                    system=EXTRACT_SYSTEM,
                )
                import json

                match = re.search(r"\{.*\}", raw, re.S)
                if match:
                    data = json.loads(match.group())
                    for item in data.get("facts", []):
                        fact = str(item.get("fact", "")).strip()
                        if len(fact) < 4:
                            continue
                        conf = float(item.get("confidence", 0.6))
                        facts.append(
                            {
                                "fact": fact,
                                "confidence": conf,
                                "source": "conversation",
                            }
                        )
            except Exception:
                pass

        if user_message:
            for pattern, label in (
                (r"我喜歡(.+)", "用戶喜歡{}"),
                (r"i like (.+)", "User likes {}"),
                (r"我是(.+)", "用戶是{}"),
            ):
                m = re.search(pattern, user_message, re.I)
                if m:
                    facts.append(
                        {
                            "fact": label.format(m.group(1).strip()[:80]),
                            "confidence": 0.7,
                            "source": "heuristic",
                        }
                    )

        kb["knowledgeBase"]["facts"] = _dedupe_facts(facts)[-100:]
        self.store.write_json(self.store.knowledge_path(character_id), kb)
        return kb

    def context_hint(self, character_id: str) -> str:
        kb = self.get(character_id)
        facts = kb.get("knowledgeBase", {}).get("facts", [])
        lines = [f"- {f['fact']}" for f in facts[-8:] if f.get("fact")]
        if not lines:
            return ""
        return "Known facts:\n" + "\n".join(lines)


def _dedupe_facts(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for f in facts:
        key = str(f.get("fact", "")).lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out