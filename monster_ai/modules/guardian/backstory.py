"""Enhanced Character Backstory Generator — local-first, OC-aware, multimodal-ready."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

from monster_ai.modules.guardian.oc_fingerprint import (
    OCFingerprintStore,
    embed_watermark,
    generate_fingerprint,
)

if TYPE_CHECKING:
    from monster_ai.modules.guardian.oc_fingerprint import OCFingerprintStore as OCStore


BACKSTORY_SECTIONS = (
    "origin",
    "turning_points",
    "personality_formation",
    "goals_conflicts",
    "relationships",
    "secrets_hooks",
)

BLURRED_THEME_NOTE = (
    "內容可能涉及成熟、敏感或虛構主題；公開描述已作模糊處理。"
    "完整原始實作僅由開發者持有。"
)


def _blur_sensitive(text: str) -> str:
    """Public-facing blur — keep structure, soften explicit tokens."""
    out = text
    for token in ("R18", "r18", "NSFW", "nsfw", "色情", "裸露"):
        out = out.replace(token, "【敏感主題】")
    return out


def _structured_template(name: str, traits: str, theme: str) -> dict[str, str]:
    theme_blur = _blur_sensitive(theme or "成熟、敏感或虛構主題")
    return {
        "origin": f"{name} 的出生與早期環境塑造了其世界觀基礎（{theme_blur}）。",
        "turning_points": f"關鍵轉折：{traits[:120] or '未指定特質'} 在壓力下被放大，形成不可逆的選擇。",
        "personality_formation": f"性格由內在動機與外在事件共同鍛造；核心驅力與 {traits[:80] or '角色特質'} 緊密相連。",
        "goals_conflicts": "短期目標與長期願景存在張力；道德、生存與關係三者互相拉扯。",
        "relationships": "重要關係網絡定義信任、背叛與成長的節奏。",
        "secrets_hooks": "保留未公開伏筆，供後續角色扮演與多模態生成延展。",
    }


async def _llm_backstory(
    *,
    name: str,
    traits: str,
    theme: str,
    worldview: str,
    repair: Any,
) -> dict[str, str] | None:
    if repair is None:
        return None
    prompt = f"""Generate a structured OC backstory in JSON for character "{name}".
Traits: {traits}
Worldview: {worldview}
Theme note (blurred public): mature/sensitive/fictional topics allowed locally.
Return ONLY JSON with keys: {", ".join(BACKSTORY_SECTIONS)}.
Each value 2-4 sentences in Traditional Chinese."""
    try:
        raw = await repair.generate(prompt, system="You output valid JSON only.")
        if not raw:
            return None
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            return None
        data = json.loads(match.group(0))
        if isinstance(data, dict) and all(k in data for k in BACKSTORY_SECTIONS):
            return {k: _blur_sensitive(str(data[k])) for k in BACKSTORY_SECTIONS}
    except Exception:
        return None
    return None


class BackstoryGenerator:
    def __init__(self, oc_store: OCFingerprintStore) -> None:
        self.oc_store = oc_store

    async def generate(
        self,
        *,
        card: dict[str, Any],
        owner_id: str = "local",
        theme: str = "",
        ephemeral: bool = False,
        check_plagiarism: bool = True,
        repair: Any = None,
        multimodal: bool = False,
    ) -> dict[str, Any]:
        name = str(card.get("name") or "未命名角色")
        traits = str(card.get("personality") or card.get("description") or "")
        worldview = str(card.get("worldview") or "")

        fp_record = generate_fingerprint(card, owner_id=owner_id)
        collision: dict[str, Any] | None = None
        if check_plagiarism:
            collision = self.oc_store.find_similar(fp_record.get("content_hash", ""))
            if collision and collision.get("owner_id") != owner_id:
                return {
                    "ok": False,
                    "blocked": True,
                    "reason": "oc_fingerprint_collision",
                    "message": "偵測到與既有 OC 指紋過於相似，已阻擋生成以保护原創性。",
                    "collision_owner": collision.get("owner_id"),
                }

        sections = await _llm_backstory(
            name=name,
            traits=traits,
            theme=theme,
            worldview=worldview,
            repair=repair,
        )
        if sections is None:
            sections = _structured_template(name, traits, theme)

        protected_card = embed_watermark(card, fp_record)
        self.oc_store.save(card.get("id", name), fp_record)

        narrative = "\n\n".join(f"## {k}\n{v}" for k, v in sections.items())
        result: dict[str, Any] = {
            "ok": True,
            "character_name": name,
            "sections": sections,
            "narrative": narrative,
            "public_description_blurred": True,
            "theme_note": BLURRED_THEME_NOTE,
            "fingerprint": fp_record.get("fingerprint"),
            "watermark": fp_record.get("watermark"),
            "ephemeral": ephemeral,
            "stored": not ephemeral,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "multimodal": {
                "image_prompt_suggested": f"character portrait, {name}, {traits[:100]}, cinematic",
                "voice_tone_suggested": traits[:60] or "neutral",
                "enabled": multimodal,
            },
            "protected_card": protected_card,
        }
        if ephemeral:
            result["prompt_discarded"] = True
        return result