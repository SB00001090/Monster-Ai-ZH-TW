"""CLI entry: monster-ai-webui"""
from __future__ import annotations

import argparse
import logging
import sys
import webbrowser

import uvicorn

from monster_ai_webui import __version__
from monster_ai_webui.app import create_app
from monster_ai_webui.config import WebUISettings
from monster_ai_webui.launcher import ensure_backends
from monster_ai_webui.static_resolver import MODE_FALLBACK, MODE_REACT


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="monster-ai-webui",
        description="Monster AI Web UI gateway (static UI + API proxy)",
    )
    p.add_argument("--host", default=None, help="Bind host (default 127.0.0.1)")
    p.add_argument("--port", type=int, default=None, help="Web UI port (default 7860)")
    p.add_argument(
        "--monster-api-port",
        type=int,
        default=None,
        help="Internal Monster AI API port (default 7861)",
    )
    p.add_argument("--node-api-port", type=int, default=None, help="Node tRPC port (default 3000)")
    p.add_argument("--monster-ai-root", default=None, help="Path to monster-ai repo root")
    p.add_argument("--no-launch", action="store_true", help="Do not start backends; proxy only")
    p.add_argument("--no-browser", action="store_true", help="Do not open browser")
    p.add_argument("--web-root", default=None, help="Override static files directory")
    p.add_argument("--log-level", default=None, choices=["debug", "info", "warning", "error"])
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    settings = WebUISettings()
    if args.host:
        settings.host = args.host
    if args.port:
        settings.port = args.port
    if args.monster_api_port:
        settings.monster_api_port = args.monster_api_port
        settings.monster_api_url = f"http://127.0.0.1:{args.monster_api_port}"
    if args.node_api_port:
        settings.node_api_port = args.node_api_port
        settings.node_api_url = f"http://127.0.0.1:{args.node_api_port}"
    if args.no_browser:
        settings.open_browser = False
    if args.no_launch:
        settings.auto_launch = False
    if args.log_level:
        settings.log_level = args.log_level
    web_root_override = args.web_root or settings.web_root_override

    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if settings.auto_launch:
        try:
            ensure_backends(
                monster_ai_root=args.monster_ai_root,
                monster_port=settings.monster_api_port,
                node_port=settings.node_api_port,
                host=settings.host,
            )
        except Exception as exc:
            print(f"ERROR: Failed to start backends: {exc}", file=sys.stderr)
            return 1

    settings.apply_env()
    app = create_app(web_root_override)
    mode = getattr(app.state, "ui_mode", "unknown")
    mode_label = {
        MODE_REACT: "React (full UI)",
        MODE_FALLBACK: "HTML fallback",
        "custom": "custom",
    }.get(mode, mode)

    url = f"http://{settings.host}:{settings.port}"
    print("Monster AI Web UI gateway")
    print(f"  UI mode     : {mode_label}")
    print(f"  Web UI      : {url}")
    print(f"  Monster API : {settings.monster_api_url}")
    print(f"  Node tRPC   : {settings.node_api_url}")
    print("Keep this window open while using Monster AI.")

    if settings.open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())