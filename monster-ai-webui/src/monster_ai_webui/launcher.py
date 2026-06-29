"""Start or reuse Monster AI Python API and Node tRPC backends."""
from __future__ import annotations

import atexit
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from monster_ai_webui.config import find_monster_ai_root
from monster_ai_webui.health import port_open, probe_monster_api, probe_node_api

_monster_proc: subprocess.Popen | None = None
_node_proc: subprocess.Popen | None = None


def _which(cmd: str) -> str | None:
    return shutil.which(cmd)


def _log_path(repo: Path) -> Path:
    log = repo / "data" / "logs" / "webui-launcher.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    return log


def _stop_proc(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def _stop_children() -> None:
    global _monster_proc, _node_proc
    _stop_proc(_node_proc)
    _stop_proc(_monster_proc)
    _node_proc = None
    _monster_proc = None


atexit.register(_stop_children)


def _wait_until(predicate, timeout: int = 45, interval: float = 1.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def ensure_monster_api(
    repo: Path,
    *,
    host: str = "127.0.0.1",
    port: int = 7861,
) -> str:
    global _monster_proc
    base = f"http://{host}:{port}"
    if probe_monster_api(base):
        print(f"Monster AI API already running at {base} — reusing.")
        os.environ["MONSTER_API_URL"] = base
        os.environ["MONSTER_PORT"] = str(port)
        return base

    if port_open(host, port):
        print(f"WARNING: Port {port} is open but /health did not respond as Monster AI.")

    main_py = repo / "main.py"
    if not main_py.is_file():
        raise FileNotFoundError(f"main.py not found in {repo}")

    env = os.environ.copy()
    env["MONSTER_PORT"] = str(port)
    env["MONSTER_HOST"] = host
    log = _log_path(repo)
    print(f"Starting Monster AI API on {base} (log: {log})")
    with log.open("a", encoding="utf-8") as log_file:
        log_file.write(f"\n--- monster api start {time.time()} ---\n")
        _monster_proc = subprocess.Popen(
            [sys.executable, str(main_py)],
            cwd=str(repo),
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
        )

    if not _wait_until(lambda: probe_monster_api(base)):
        raise RuntimeError(f"Monster AI API did not become ready at {base}. See {log}")

    os.environ["MONSTER_API_URL"] = base
    print("Monster AI API is ready.")
    return base


def _discover_node_port(preferred: int, span: int = 10) -> int | None:
    for port in range(preferred, preferred + span):
        if probe_node_api(f"http://127.0.0.1:{port}"):
            return port
    return None


def ensure_node_api(repo: Path, *, port: int = 3000) -> str:
    global _node_proc
    base = f"http://127.0.0.1:{port}"
    discovered = _discover_node_port(port)
    if discovered is not None:
        base = f"http://127.0.0.1:{discovered}"
        print(f"Node tRPC API already running at {base} — reusing.")
        os.environ["NODE_API_URL"] = base
        return base

    pnpm = "pnpm.cmd" if sys.platform == "win32" else "pnpm"
    if not _which(pnpm):
        raise RuntimeError("pnpm not found. Install Node.js 20+ and: npm install -g pnpm")

    if not (repo / "node_modules").is_dir():
        print("Installing Node dependencies...")
        r = subprocess.run([pnpm, "install"], cwd=str(repo), shell=False)
        if r.returncode != 0:
            raise RuntimeError("pnpm install failed")

    log = _log_path(repo)
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["API_ONLY"] = "1"
    env["NODE_ENV"] = "development"
    env["NODE_API_URL"] = base
    print(f"Starting Node tRPC API on {base} (log: {log})")
    with log.open("a", encoding="utf-8") as log_file:
        log_file.write(f"\n--- node api start {time.time()} ---\n")
        _node_proc = subprocess.Popen(
            [pnpm, "exec", "tsx", "server/_core/index.ts"],
            cwd=str(repo),
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
        )

    if not _wait_until(lambda: probe_node_api(base)):
        raise RuntimeError(f"Node tRPC API did not become ready at {base}. See {log}")

    os.environ["NODE_API_URL"] = base
    print("Node tRPC API is ready.")
    return base


def ensure_backends(
    *,
    monster_ai_root: str | None = None,
    monster_port: int = 7861,
    node_port: int = 3000,
    host: str = "127.0.0.1",
) -> dict[str, str]:
    repo = find_monster_ai_root(monster_ai_root)
    if repo is None:
        raise RuntimeError(
            "Monster AI repo not found. Set MONSTER_AI_ROOT or run from the repo, "
            "or pass --monster-ai-root."
        )
    print(f"Using Monster AI repo: {repo}")
    monster_url = ensure_monster_api(repo, host=host, port=monster_port)
    node_url = ensure_node_api(repo, port=node_port)
    info = {
        "repo": str(repo),
        "monster_api_url": monster_url,
        "node_api_url": node_url,
    }
    (repo / "data" / "logs" / "webui-launcher.json").write_text(
        json.dumps(info, indent=2),
        encoding="utf-8",
    )
    return info