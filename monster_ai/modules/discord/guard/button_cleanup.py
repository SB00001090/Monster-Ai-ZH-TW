"""Delete / strip obsolete Discord UI messages (tutorial, setup) to avoid dead buttons."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Callable, Iterable

import discord

logger = logging.getLogger(__name__)

STALE_REASON = "🗑️ 舊介面已作廢 — 請使用最新指令（`/tutorial` 或 `/guard setup`）"


async def delete_or_strip_message(
    msg: discord.Message,
    *,
    reason: str = STALE_REASON,
) -> str:
    """Try delete; else strip components. Returns 'deleted' | 'stripped' | 'failed'."""
    try:
        await msg.delete()
        return "deleted"
    except discord.Forbidden:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("delete failed: %s", exc)
    try:
        await msg.edit(content=reason, embed=None, view=None)
        return "stripped"
    except Exception as exc:  # noqa: BLE001
        logger.debug("strip failed: %s", exc)
        return "failed"


async def delete_or_strip_by_id(
    bot: discord.Client,
    channel_id: int,
    message_id: int,
    *,
    reason: str = STALE_REASON,
) -> str:
    channel: Any = bot.get_channel(channel_id)
    if channel is None:
        try:
            channel = await bot.fetch_channel(channel_id)
        except Exception:  # noqa: BLE001
            return "failed"
    try:
        msg = await channel.fetch_message(message_id)
    except Exception:  # noqa: BLE001
        return "failed"
    return await delete_or_strip_message(msg, reason=reason)


def _component_custom_ids(msg: discord.Message) -> list[str]:
    ids: list[str] = []
    for row in msg.components or []:
        children = getattr(row, "children", None) or []
        for child in children:
            cid = getattr(child, "custom_id", None)
            if cid:
                ids.append(str(cid))
    return ids


def is_monster_ui_message(
    msg: discord.Message,
    bot_user: discord.ClientUser | discord.User,
    *,
    title_keywords: Iterable[str] = (),
    custom_id_prefixes: Iterable[str] = (),
) -> bool:
    if msg.author.id != bot_user.id:
        return False
    titles = tuple(title_keywords)
    prefixes = tuple(custom_id_prefixes)
    if msg.embeds:
        emb = msg.embeds[0]
        title = emb.title or ""
        footer = emb.footer.text if emb.footer else "" or ""
        for kw in titles:
            if kw in title or kw in footer:
                return True
    cids = _component_custom_ids(msg)
    if not cids:
        return False
    for cid in cids:
        for p in prefixes:
            if cid.startswith(p):
                return True
    return False


async def purge_channel_ui_messages(
    channel: discord.abc.Messageable,
    bot_user: discord.ClientUser | discord.User,
    *,
    title_keywords: Iterable[str],
    custom_id_prefixes: Iterable[str],
    limit: int = 100,
    keep_message_id: int | None = None,
    reason: str = STALE_REASON,
) -> dict[str, int]:
    """Scan recent history and remove matching bot UI messages."""
    stats = {"deleted": 0, "stripped": 0, "failed": 0, "scanned": 0}
    if not hasattr(channel, "history"):
        return stats
    try:
        async for msg in channel.history(limit=limit):  # type: ignore[attr-defined]
            stats["scanned"] += 1
            if keep_message_id and msg.id == keep_message_id:
                continue
            if not is_monster_ui_message(
                msg,
                bot_user,
                title_keywords=title_keywords,
                custom_id_prefixes=custom_id_prefixes,
            ):
                continue
            # Prefer messages that still have components
            if not msg.components and not (
                msg.embeds
                and any(
                    kw in ((msg.embeds[0].title or "") + (msg.embeds[0].footer.text or "" if msg.embeds[0].footer else ""))
                    for kw in title_keywords
                )
            ):
                continue
            result = await delete_or_strip_message(msg, reason=reason)
            stats[result] = stats.get(result, 0) + 1
    except discord.Forbidden:
        logger.warning("Cannot scan history in channel %s", getattr(channel, "id", "?"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("purge_channel_ui_messages failed: %s", exc)
    return stats


class MessageRegistry:
    """
    Persist list of UI message ids per scope so we can delete ALL on refresh.
    File: data/guard/ui_messages.json
    """

    def __init__(self, path: Path, *, kind: str) -> None:
        self.path = path
        self.kind = kind
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # scope -> {"active": message_id|None, "messages": [[ch, mid], ...]}
        self._data: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self.path.is_file():
            self._data = {}
            return
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and self.kind in raw:
                self._data = raw[self.kind] if isinstance(raw[self.kind], dict) else {}
            elif isinstance(raw, dict):
                # plain dict of scopes
                self._data = raw
            else:
                self._data = {}
        except Exception:  # noqa: BLE001
            self._data = {}

    def _save(self) -> None:
        try:
            existing: dict[str, Any] = {}
            if self.path.is_file():
                try:
                    existing = json.loads(self.path.read_text(encoding="utf-8"))
                    if not isinstance(existing, dict):
                        existing = {}
                except Exception:  # noqa: BLE001
                    existing = {}
            # store under kind key if file is multi-kind
            if any(k in existing for k in ("tutorial", "setup")) or self.kind in existing:
                existing[self.kind] = self._data
                payload = existing
            else:
                # migrate: wrap
                payload = {self.kind: self._data}
            self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            logger.debug("registry save failed: %s", exc)

    def _bucket(self, scope: int) -> dict[str, Any]:
        key = str(scope)
        if key not in self._data:
            self._data[key] = {"active": None, "messages": []}
        return self._data[key]

    def list_messages(self, scope: int) -> list[tuple[int, int]]:
        b = self._bucket(scope)
        out: list[tuple[int, int]] = []
        for item in b.get("messages") or []:
            try:
                out.append((int(item[0]), int(item[1])))
            except Exception:  # noqa: BLE001
                continue
        return out

    def active_id(self, scope: int) -> int | None:
        b = self._bucket(scope)
        a = b.get("active")
        return int(a) if a is not None else None

    def is_active(self, scope: int, message_id: int) -> bool:
        return self.active_id(scope) == int(message_id)

    def add_and_set_active(self, scope: int, channel_id: int, message_id: int) -> list[tuple[int, int]]:
        """Register new message as active; return ALL previous messages to purge."""
        b = self._bucket(scope)
        old = self.list_messages(scope)
        # keep unique list, append new
        msgs = [m for m in old if m[1] != message_id]
        msgs.append((channel_id, message_id))
        b["messages"] = [[c, m] for c, m in msgs]
        b["active"] = message_id
        self._save()
        return old  # caller deletes old including previous actives

    def clear_scope(self, scope: int) -> list[tuple[int, int]]:
        old = self.list_messages(scope)
        self._data.pop(str(scope), None)
        self._save()
        return old

    def mark_inactive(self, scope: int, message_id: int) -> None:
        b = self._bucket(scope)
        if b.get("active") == message_id:
            b["active"] = None
        msgs = [m for m in self.list_messages(scope) if m[1] != message_id]
        b["messages"] = [[c, m] for c, m in msgs]
        if not msgs:
            self._data.pop(str(scope), None)
        self._save()
