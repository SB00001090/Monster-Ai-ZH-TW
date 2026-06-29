"""Monster AI — local-first entry point."""
from __future__ import annotations

import logging
from pathlib import Path

import uvicorn

from monster_ai.app import create_app
from monster_ai.config import load_settings


def main() -> None:
    root = Path(__file__).resolve().parent
    config_path = root / "config.yaml"
    data_dir = root / "data" / "monsterlock"
    try:
        from monster_ai.protection.monsterlock.config_guard import enforce_config_guard

        if config_path.exists():
            enforce_config_guard(config_path, data_dir=data_dir, hard_fail=True)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("Config guard skipped: %s", exc)

    settings = load_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    app = create_app(settings)
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )


if __name__ == "__main__":
    main()