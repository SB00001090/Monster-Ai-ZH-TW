"""Discord interaction helpers — always ACK within 3s to avoid 10062 timeouts."""
from __future__ import annotations

import logging
import time
from typing import Any

import discord

logger = logging.getLogger(__name__)

# Curriculum / heavy tasks check this so Discord can ACK within 3s
_last_interaction_mono: float = 0.0
_INTERACTION_BUSY_SEC = 3.0


def note_interaction() -> None:
    """Call at the start of any slash/component handler."""
    global _last_interaction_mono
    _last_interaction_mono = time.monotonic()


def seconds_since_interaction() -> float:
    if _last_interaction_mono <= 0:
        return 1e9
    return time.monotonic() - _last_interaction_mono


async def wait_while_discord_busy(*, max_wait: float = 15.0) -> None:
    """
    Heavy background work (curriculum) should call this between steps.
    Yields until no recent Discord interaction or max_wait elapsed.
    """
    import asyncio

    deadline = time.monotonic() + max_wait
    while seconds_since_interaction() < _INTERACTION_BUSY_SEC:
        if time.monotonic() >= deadline:
            break
        await asyncio.sleep(0.15)


async def safe_defer(
    interaction: discord.Interaction,
    *,
    thinking: bool = False,
    ephemeral: bool = False,
) -> bool:
    """Acknowledge interaction immediately. Returns False if already expired (10062)."""
    note_interaction()
    try:
        if interaction.response.is_done():
            return True
        await interaction.response.defer(thinking=thinking, ephemeral=ephemeral)
        return True
    except discord.NotFound:
        logger.warning(
            "Interaction expired before defer (10062) cmd=%s",
            getattr(interaction.command, "name", "?"),
        )
        return False
    except discord.InteractionResponded:
        return True
    except discord.HTTPException as exc:
        logger.warning("defer failed: %s", exc)
        return False


async def safe_followup(
    interaction: discord.Interaction,
    content: str | None = None,
    **kwargs: Any,
) -> bool:
    """Send followup after defer. Returns False on failure."""
    note_interaction()
    try:
        if content is not None:
            await interaction.followup.send(content, **kwargs)
        else:
            await interaction.followup.send(**kwargs)
        return True
    except discord.NotFound:
        logger.warning("followup expired (10062)")
        return False
    except Exception as exc:  # noqa: BLE001
        logger.debug("followup failed: %s", exc)
        return False


async def safe_edit_original(
    interaction: discord.Interaction,
    **kwargs: Any,
) -> bool:
    note_interaction()
    try:
        await interaction.edit_original_response(**kwargs)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("edit_original failed: %s", exc)
        return False


async def safe_respond(
    interaction: discord.Interaction,
    content: str | None = None,
    **kwargs: Any,
) -> bool:
    """Respond or followup depending on whether already deferred."""
    note_interaction()
    try:
        if interaction.response.is_done():
            if content is not None:
                await interaction.followup.send(content, **kwargs)
            else:
                await interaction.followup.send(**kwargs)
        else:
            if content is not None:
                await interaction.response.send_message(content, **kwargs)
            else:
                await interaction.response.send_message(**kwargs)
        return True
    except discord.NotFound:
        logger.warning("respond expired (10062)")
        return False
    except Exception as exc:  # noqa: BLE001
        logger.debug("respond failed: %s", exc)
        return False


async def safe_edit_message(
    interaction: discord.Interaction,
    **kwargs: Any,
) -> bool:
    """Component ACK via edit_message — preferred over defer for selects/buttons."""
    note_interaction()
    try:
        if not interaction.response.is_done():
            await interaction.response.edit_message(**kwargs)
            return True
        if interaction.message is not None:
            await interaction.message.edit(**kwargs)
            return True
    except discord.NotFound:
        logger.warning("edit_message expired (10062)")
        return False
    except Exception as exc:  # noqa: BLE001
        logger.debug("edit_message failed: %s", exc)
    return False
