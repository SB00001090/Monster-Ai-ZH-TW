"""Persona presets for Monster AI chat and roleplay."""
from monster_ai.persona.grok import (
    GROK_BASE_SYSTEM,
    GROK_ROLEPLAY_APPENDIX,
    build_system_prompt,
    resolve_persona,
)

__all__ = [
    "GROK_BASE_SYSTEM",
    "GROK_ROLEPLAY_APPENDIX",
    "build_system_prompt",
    "resolve_persona",
]