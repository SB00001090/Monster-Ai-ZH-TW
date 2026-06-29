#!/usr/bin/env python3
"""Copy built UI assets into the pip package before build/install."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PKG_ROOT.parent
WEB_PKG = PKG_ROOT / "src" / "monster_ai_webui" / "web"
REACT_DST = WEB_PKG / "react"
FALLBACK_DST = WEB_PKG / "fallback"


def _copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    if not src.is_dir():
        return
    shutil.copytree(src, dst)
    print(f"  copied {src} -> {dst}")


def main() -> int:
    print(f"Repo root: {REPO_ROOT}")
    print(f"Package web dir: {WEB_PKG}")
    WEB_PKG.mkdir(parents=True, exist_ok=True)

    dist_public = REPO_ROOT / "dist" / "public"
    if (dist_public / "index.html").is_file():
        print("Syncing React build (dist/public)...")
        _copy_tree(dist_public, REACT_DST)
    else:
        print("WARNING: dist/public/index.html not found — run: npm run build")
        if REACT_DST.exists():
            shutil.rmtree(REACT_DST)

    static_src = REPO_ROOT / "monster_ai" / "web" / "static"
    security_src = REPO_ROOT / "monster_ai" / "web" / "static" / "monsterai-security.html"
    client_security = REPO_ROOT / "client" / "public" / "monsterai-security.html"

    print("Syncing HTML fallback (monster_ai/web/static)...")
    _copy_tree(static_src, FALLBACK_DST)

    for logo in (
        REPO_ROOT / "client" / "public" / "monster-logo.png",
        REPO_ROOT / "client" / "public" / "favicon.ico",
    ):
        if logo.is_file():
            shutil.copy2(logo, FALLBACK_DST / logo.name)
            if REACT_DST.is_dir():
                shutil.copy2(logo, REACT_DST / logo.name)
            print(f"  copied {logo.name}")

    if client_security.is_file():
        shutil.copy2(client_security, FALLBACK_DST / "monsterai-security.html")
        if REACT_DST.is_dir():
            shutil.copy2(client_security, REACT_DST / "monsterai-security.html")
    elif security_src.is_file():
        shutil.copy2(security_src, FALLBACK_DST / "monsterai-security.html")

    if not (FALLBACK_DST / "index.html").is_file():
        print("ERROR: fallback index.html missing", file=sys.stderr)
        return 1

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())