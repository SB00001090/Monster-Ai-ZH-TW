"""Hong Kong debt-collection / harassment crime keyword rules."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

# Categories aligned with HK illegal debt collection / intimidation offences
DEFAULT_HK_RULES: dict[str, Any] = {
    "version": "hk-2026.06",
    "locale": "zh-HK",
    "categories": {
        "red_paint_intimidation": {
            "weight": 90,
            "keywords": ["淋紅油", "潑紅油", "紅油字", "淋油", "潑漆", "塗鴉威脅"],
        },
        "debt_collection_illegal": {
            "weight": 85,
            "keywords": ["收數", "收數公司", "非法收債", "逼債", "追債", "上門收數", "貼大字報"],
        },
        "threat_harassment": {
            "weight": 88,
            "keywords": ["恐嚇", "威脅", "騷擾", "跟蹤", "跟蹤債務人", "騷擾家人", "騷擾親友", "打爆電話"],
        },
        "third_party_pressure": {
            "weight": 82,
            "keywords": ["向第三者施壓", "騷擾同事", "騷擾雇主", "告知雇主", "告知鄰居", "公開債務"],
        },
        "usury_cycle": {
            "weight": 80,
            "keywords": ["高利貸", "放數", "財務公司循環", "借新還舊", "砍頭息", "天息", "貴利"],
        },
        "false_police_report": {
            "weight": 92,
            "keywords": ["虛報警情", "報假案", "訛稱警方", "假冒警察", "假警員"],
        },
        "violence_coercion": {
            "weight": 95,
            "keywords": ["斷肢", "傷害威脅", "燒屋", "放火", "綁架", "禁錮", "毆打"],
        },
    },
    "phrases": [
        "點樣逼佢還錢",
        "如何騷擾佢家人",
        "幫我寫恐嚇信",
        "收數話術",
        "淋紅油地址",
        "如何避開警方追蹤收數",
    ],
    "block_threshold": 70,
    "lock_threshold": 85,
}


@dataclass
class IntentResult:
    score: int = 0
    blocked: bool = False
    lock_trigger: bool = False
    categories: list[str] = field(default_factory=list)
    matches: list[str] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "blocked": self.blocked,
            "lock_trigger": self.lock_trigger,
            "categories": self.categories,
            "matches": self.matches[:8],
            "summary": self.summary,
        }


def load_hk_rules(path: Path) -> dict[str, Any]:
    if path.exists():
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if data.get("categories"):
            return data
    return DEFAULT_HK_RULES.copy()


def score_prompt(text: str, rules: dict[str, Any]) -> IntentResult:
    """Rule-based HK crime intent scoring."""
    if not text or not text.strip():
        return IntentResult()

    blob = text.lower()
    blob_zh = text
    result = IntentResult()
    block_threshold = int(rules.get("block_threshold", 70))
    lock_threshold = int(rules.get("lock_threshold", 85))
    max_score = 0

    for cat_name, cat in rules.get("categories", {}).items():
        weight = int(cat.get("weight", 50))
        for kw in cat.get("keywords", []):
            if kw.lower() in blob or kw in blob_zh:
                result.matches.append(kw)
                if cat_name not in result.categories:
                    result.categories.append(cat_name)
                max_score = max(max_score, weight)

    for phrase in rules.get("phrases", []):
        if phrase.lower() in blob or phrase in blob_zh:
            result.matches.append(phrase)
            max_score = max(max_score, 88)

    # Multi-match escalation
    if len(result.categories) >= 2:
        max_score = min(100, max_score + 10)
    if len(result.matches) >= 3:
        max_score = min(100, max_score + 5)

    result.score = max_score
    result.blocked = max_score >= block_threshold
    result.lock_trigger = max_score >= lock_threshold
    if result.matches:
        result.summary = f"HK crime signals: {', '.join(result.categories[:3])}"
    return result


async def llm_analyze_prompt(
    text: str,
    repair_engine: Any,
    *,
    enabled: bool = True,
) -> IntentResult:
    """Optional LLM refinement for borderline prompts."""
    base = score_prompt(text, DEFAULT_HK_RULES)
    if not enabled or base.score < 40 or base.score >= 85:
        return base

    system = (
        "You are a Hong Kong law enforcement crime-intent classifier. "
        "Analyze if the user prompt seeks help with illegal debt collection, "
        "intimidation (淋紅油), harassment of family/third parties, usury, or false police reports. "
        "Reply ONLY with JSON: {\"score\":0-100,\"crime\":true/false,\"category\":\"...\"}"
    )
    try:
        raw = await repair_engine.generate(
            f"Classify this prompt:\n{text[:1500]}",
            system=system,
        )
        import json

        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(raw[start:end])
            llm_score = int(data.get("score", 0))
            if data.get("crime") and llm_score > base.score:
                base.score = llm_score
                base.blocked = llm_score >= 70
                base.lock_trigger = llm_score >= 85
                cat = data.get("category", "llm_detected")
                if cat not in base.categories:
                    base.categories.append(str(cat))
                base.summary = f"LLM confirmed: {cat}"
    except Exception:  # noqa: BLE001
        pass
    return base