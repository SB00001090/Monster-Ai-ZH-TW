"""Per-guild MonsterGuard configuration (SQLite)."""
from __future__ import annotations

import aiosqlite
from dataclasses import dataclass
from pathlib import Path

DEFAULTS = {
    "protection_level": "standard",
    "action_mode": "delete_warn",
    "mod_channel_id": None,
    "ai_enabled": True,
    "guard_enabled": True,
    "setup_complete": False,
    "tutorial_complete": False,
    "tutorial_auto_sent": False,
}


@dataclass
class GuildConfig:
    guild_id: int
    protection_level: str = "standard"
    action_mode: str = "delete_warn"
    mod_channel_id: int | None = None
    ai_enabled: bool = True
    guard_enabled: bool = True
    setup_complete: bool = False
    block_threshold: int = 80
    warn_threshold: int = 50
    ai_threshold: int = 40
    tutorial_complete: bool = False
    tutorial_auto_sent: bool = False


class GuildConfigStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    async def init(self) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS guild_config (
                    guild_id INTEGER PRIMARY KEY,
                    protection_level TEXT DEFAULT 'standard',
                    action_mode TEXT DEFAULT 'delete_warn',
                    mod_channel_id INTEGER,
                    ai_enabled INTEGER DEFAULT 1,
                    guard_enabled INTEGER DEFAULT 1,
                    setup_complete INTEGER DEFAULT 0,
                    block_threshold INTEGER DEFAULT 80,
                    warn_threshold INTEGER DEFAULT 50,
                    ai_threshold INTEGER DEFAULT 40,
                    tutorial_complete INTEGER DEFAULT 0,
                    tutorial_auto_sent INTEGER DEFAULT 0
                )
                """
            )
            # Migrate older DBs
            for col, default in (
                ("tutorial_complete", "0"),
                ("tutorial_auto_sent", "0"),
            ):
                try:
                    await db.execute(
                        f"ALTER TABLE guild_config ADD COLUMN {col} INTEGER DEFAULT {default}"
                    )
                except Exception:  # noqa: BLE001
                    pass
            await db.commit()

    def _row_bool(self, row: aiosqlite.Row, key: str, default: bool = False) -> bool:
        try:
            if key not in row.keys():
                return default
            val = row[key]
            return bool(val) if val is not None else default
        except (IndexError, KeyError):
            return default

    async def get(self, guild_id: int) -> GuildConfig:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM guild_config WHERE guild_id = ?", (guild_id,)
            ) as cursor:
                row = await cursor.fetchone()
        if not row:
            return GuildConfig(guild_id=guild_id)
        return GuildConfig(
            guild_id=guild_id,
            protection_level=row["protection_level"],
            action_mode=row["action_mode"],
            mod_channel_id=row["mod_channel_id"],
            ai_enabled=bool(row["ai_enabled"]),
            guard_enabled=bool(row["guard_enabled"]),
            setup_complete=bool(row["setup_complete"]),
            block_threshold=row["block_threshold"],
            warn_threshold=row["warn_threshold"],
            ai_threshold=row["ai_threshold"],
            tutorial_complete=self._row_bool(row, "tutorial_complete"),
            tutorial_auto_sent=self._row_bool(row, "tutorial_auto_sent"),
        )

    async def save(self, cfg: GuildConfig) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO guild_config (
                    guild_id, protection_level, action_mode, mod_channel_id,
                    ai_enabled, guard_enabled, setup_complete,
                    block_threshold, warn_threshold, ai_threshold,
                    tutorial_complete, tutorial_auto_sent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET
                    protection_level=excluded.protection_level,
                    action_mode=excluded.action_mode,
                    mod_channel_id=excluded.mod_channel_id,
                    ai_enabled=excluded.ai_enabled,
                    guard_enabled=excluded.guard_enabled,
                    setup_complete=excluded.setup_complete,
                    block_threshold=excluded.block_threshold,
                    warn_threshold=excluded.warn_threshold,
                    ai_threshold=excluded.ai_threshold,
                    tutorial_complete=excluded.tutorial_complete,
                    tutorial_auto_sent=excluded.tutorial_auto_sent
                """,
                (
                    cfg.guild_id,
                    cfg.protection_level,
                    cfg.action_mode,
                    cfg.mod_channel_id,
                    int(cfg.ai_enabled),
                    int(cfg.guard_enabled),
                    int(cfg.setup_complete),
                    cfg.block_threshold,
                    cfg.warn_threshold,
                    cfg.ai_threshold,
                    int(cfg.tutorial_complete),
                    int(cfg.tutorial_auto_sent),
                ),
            )
            await db.commit()

    async def list_guilds(self) -> list[int]:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT guild_id FROM guild_config") as cursor:
                rows = await cursor.fetchall()
        return [r[0] for r in rows]