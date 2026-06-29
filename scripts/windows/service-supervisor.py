"""Monster AI Windows service supervisor: Ollama + ComfyUI headless + main.py."""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

LOG_DIR = ROOT / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "supervisor.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("supervisor")

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0
TOKEN_FILE = ROOT / "discord.token.local"
STATE_FILE = LOG_DIR / "supervisor-state.json"


@dataclass
class ManagedProc:
    name: str
    popen: subprocess.Popen | None = None
    restarts: int = 0
    last_start: float = 0.0


def _load_token() -> bool:
    if not TOKEN_FILE.exists():
        logger.warning("discord.token.local missing; MonsterGuard may stay offline")
        return False
    lines = [
        ln.strip()
        for ln in TOKEN_FILE.read_text(encoding="utf-8-sig").splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    if lines:
        os.environ["MONSTER_DISCORD_TOKEN"] = lines[0]
        logger.info("Discord token loaded for MonsterGuard (len=%s)", len(lines[0]))
        return True
    logger.warning("discord.token.local empty; MonsterGuard may stay offline")
    return False


def _http_ok(url: str) -> bool:
    try:
        import httpx

        r = httpx.get(url, timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def _monster_ai_healthy() -> bool:
    return _http_ok("http://127.0.0.1:7860/api/callguard/status")


def _guard_bot_running() -> bool:
    try:
        import httpx

        r = httpx.get("http://127.0.0.1:7860/api/guard/status", timeout=5)
        if r.status_code != 200:
            return False
        return bool(r.json().get("bot", {}).get("running"))
    except Exception:
        return False


def _kill_listeners_on_port(port: int) -> None:
    if sys.platform != "win32":
        return
    result = subprocess.run(
        f'netstat -ano | findstr ":{port}" | findstr LISTENING',
        shell=True,
        capture_output=True,
        text=True,
        check=False,
    )
    pids: set[int] = set()
    for line in result.stdout.splitlines():
        parts = line.split()
        if parts:
            try:
                pids.add(int(parts[-1]))
            except ValueError:
                continue
    for pid in pids:
        logger.warning("Freeing port %s: killing PID %s", port, pid)
        subprocess.run(f"taskkill /PID {pid} /F", shell=True, check=False)


def _resolve_comfyui() -> Path | None:
    from detect_comfyui import find_comfyui

    return find_comfyui()


def _start_comfyui_managed(comfy_path: Path) -> subprocess.Popen:
    from comfyui_headless import start_comfyui_headless

    log = LOG_DIR / "comfyui.log"
    return start_comfyui_headless(comfy_path, log)


def _start_process(name: str, cmd: list[str], *, cwd: Path, log_name: str) -> subprocess.Popen:
    if name == "monster-ai":
        _load_token()
    log_path = LOG_DIR / log_name
    log_f = open(log_path, "a", encoding="utf-8")  # noqa: SIM115
    kwargs: dict = {
        "cwd": str(cwd),
        "stdout": log_f,
        "stderr": subprocess.STDOUT,
        "env": os.environ.copy(),
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = CREATE_NO_WINDOW
    logger.info("Starting %s: %s", name, " ".join(cmd))
    return subprocess.Popen(cmd, **kwargs)


def _needs_comfyui() -> bool:
    from monster_ai.config import load_settings

    s = load_settings()
    if not s.launcher.comfyui_enabled:
        return False
    return s.modules.image.enabled or s.modules.video.enabled


def _write_state(procs: dict[str, ManagedProc]) -> None:
    STATE_FILE.write_text(
        json.dumps(
            {
                "ts": time.time(),
                "processes": {
                    k: {
                        "pid": v.popen.pid if v.popen else None,
                        "restarts": v.restarts,
                        "running": v.popen.poll() is None if v.popen else False,
                    }
                    for k, v in procs.items()
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def _bootstrap_monsterlock() -> bool:
    """Pre-flight MonsterLock check before starting Monster AI (no GUI)."""
    try:
        config_path = ROOT / "config.yaml"
        data_dir = ROOT / "data" / "monsterlock"
        if config_path.exists():
            from monster_ai.protection.monsterlock.config_guard import enforce_config_guard

            try:
                enforce_config_guard(config_path, data_dir=data_dir, hard_fail=True)
            except SystemExit:
                return False

        from monster_ai.config import load_settings
        from monster_ai.protection.monsterlock import MonsterLockEngine

        settings = load_settings()
        if not settings.protection.monsterlock.enabled:
            logger.info("MonsterLock disabled in config")
            return True
        engine = MonsterLockEngine(settings.protection.monsterlock, ROOT)
        ok = engine.bootstrap()
        if ok:
            logger.info(
                "MonsterLock armed fp=%s strength=%s",
                engine.state.fingerprint_short,
                engine.state.strength,
            )
        else:
            logger.error("MonsterLock blocked startup: %s", engine.state.last_error)
        return ok
    except Exception as exc:  # noqa: BLE001
        logger.error("MonsterLock bootstrap error: %s", exc)
        return False


def main() -> int:
    os.chdir(ROOT)
    _load_token()
    os.environ.setdefault("MONSTER_GPU_PROFILE", "rtx_4090")

    if not _bootstrap_monsterlock():
        logger.error("Supervisor abort: MonsterLock policy blocked startup")
        return 2

    python = sys.executable
    procs: dict[str, ManagedProc] = {}

    # 1) Ollama
    ollama = shutil_which("ollama")
    if ollama:
        mp = ManagedProc("ollama")
        mp.popen = _start_process("ollama", [ollama, "serve"], cwd=ROOT, log_name="ollama-serve.log")
        mp.last_start = time.time()
        procs["ollama"] = mp
        for _ in range(60):
            if _http_ok("http://127.0.0.1:11434/api/tags"):
                logger.info("Ollama ready")
                break
            time.sleep(2)
        else:
            logger.warning("Ollama not responding yet; continuing")
    else:
        logger.warning("ollama not in PATH; skip ollama serve")

    # 2) ComfyUI headless
    if _needs_comfyui():
        comfy_path = _resolve_comfyui()
        if comfy_path and not _http_ok("http://127.0.0.1:8188/system_stats"):
            mp = ManagedProc("comfyui")
            mp.popen = _start_comfyui_managed(comfy_path)
            mp.last_start = time.time()
            procs["comfyui"] = mp
            for _ in range(90):
                if _http_ok("http://127.0.0.1:8188/system_stats"):
                    logger.info("ComfyUI ready")
                    break
                time.sleep(2)
        elif _http_ok("http://127.0.0.1:8188/system_stats"):
            logger.info("ComfyUI already running")

    # 3) Monster AI (+ embedded MonsterGuard bot)
    mp = ManagedProc("monster-ai")
    if _monster_ai_healthy():
        logger.info("Monster AI already healthy on :7860; supervising via health checks")
        mp.popen = None
    else:
        mp.popen = _start_process(
            "monster-ai", [python, "main.py"], cwd=ROOT, log_name="monster-ai-serve.log"
        )
    mp.last_start = time.time()
    procs["monster-ai"] = mp

    logger.info("Supervisor loop started")
    bot_offline_since: float | None = None
    try:
        while True:
            for name, mp in list(procs.items()):
                if name == "monster-ai":
                    if mp.popen is None:
                        if not _monster_ai_healthy():
                            logger.error("Monster AI offline; starting managed instance")
                            _kill_listeners_on_port(7860)
                            mp.popen = _start_process(
                                "monster-ai",
                                [python, "main.py"],
                                cwd=ROOT,
                                log_name="monster-ai-serve.log",
                            )
                            mp.last_start = time.time()
                            bot_offline_since = None
                        elif not _guard_bot_running():
                            now = time.time()
                            if bot_offline_since is None:
                                bot_offline_since = now
                                logger.warning("MonsterGuard bot offline; waiting for auto-reconnect")
                            elif now - bot_offline_since > 180:
                                logger.error(
                                    "MonsterGuard bot offline >180s; restarting Monster AI"
                                )
                                _kill_listeners_on_port(7860)
                                mp.popen = _start_process(
                                    "monster-ai",
                                    [python, "main.py"],
                                    cwd=ROOT,
                                    log_name="monster-ai-serve.log",
                                )
                                mp.last_start = time.time()
                                bot_offline_since = None
                        else:
                            bot_offline_since = None
                        continue

                    if mp.popen.poll() is not None:
                        code = mp.popen.returncode
                        if _monster_ai_healthy():
                            logger.warning(
                                "monster-ai exited (%s) but :7860 still healthy; external mode",
                                code,
                            )
                            mp.popen = None
                            bot_offline_since = None
                            continue
                        logger.error("monster-ai exited with code %s; restarting", code)
                        mp.restarts += 1
                        _kill_listeners_on_port(7860)
                        mp.popen = _start_process(
                            "monster-ai",
                            [python, "main.py"],
                            cwd=ROOT,
                            log_name="monster-ai-serve.log",
                        )
                        mp.last_start = time.time()
                        bot_offline_since = None
                    elif not _guard_bot_running():
                        now = time.time()
                        if bot_offline_since is None:
                            bot_offline_since = now
                        elif now - bot_offline_since > 180:
                            logger.error(
                                "MonsterGuard bot offline >180s; restarting managed monster-ai"
                            )
                            if mp.popen.poll() is None:
                                mp.popen.terminate()
                                try:
                                    mp.popen.wait(timeout=15)
                                except subprocess.TimeoutExpired:
                                    mp.popen.kill()
                            _kill_listeners_on_port(7860)
                            mp.popen = _start_process(
                                "monster-ai",
                                [python, "main.py"],
                                cwd=ROOT,
                                log_name="monster-ai-serve.log",
                            )
                            mp.last_start = time.time()
                            bot_offline_since = None
                    else:
                        bot_offline_since = None
                    continue

                if mp.popen is None:
                    continue
                if mp.popen.poll() is not None:
                    logger.error("%s exited with code %s; restarting", name, mp.popen.returncode)
                    mp.restarts += 1
                    if name == "ollama" and ollama:
                        mp.popen = _start_process(
                            "ollama", [ollama, "serve"], cwd=ROOT, log_name="ollama-serve.log"
                        )
                    elif name == "comfyui":
                        cp = _resolve_comfyui()
                        if cp:
                            mp.popen = _start_comfyui_managed(cp)
                    mp.last_start = time.time()
            _write_state(procs)
            time.sleep(10)
    except KeyboardInterrupt:
        logger.info("Supervisor stopping")
        for mp in procs.values():
            if mp.popen and mp.popen.poll() is None:
                mp.popen.terminate()
        return 0


def shutil_which(cmd: str) -> str | None:
    from shutil import which

    return which(cmd)


if __name__ == "__main__":
    raise SystemExit(main())