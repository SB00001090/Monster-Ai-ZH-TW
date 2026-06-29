"""Launch Monster AI with Discord token from discord.token.local."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = ROOT / "discord.token.local"
LOG_FILE = ROOT / "data" / "logs" / "monsterguard-launch.log"
DEFAULT_PORT = 7860


def _wait_enter() -> None:
    try:
        input("\nPress Enter to exit...")
    except EOFError:
        pass


def _load_port() -> int:
    config = ROOT / "config.yaml"
    if not config.exists():
        return DEFAULT_PORT
    for line in config.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("port:"):
            try:
                return int(stripped.split(":", 1)[1].strip().strip('"'))
            except ValueError:
                break
    return DEFAULT_PORT


def _pids_on_port(port: int) -> list[int]:
    result = subprocess.run(
        f'netstat -ano | findstr ":{port}" | findstr LISTENING',
        shell=True,
        capture_output=True,
        text=True,
        check=False,
    )
    pids: list[int] = []
    for line in result.stdout.splitlines():
        parts = line.split()
        if parts:
            try:
                pid = int(parts[-1])
                if pid not in pids:
                    pids.append(pid)
            except ValueError:
                continue
    return pids


def _is_server_healthy(port: int) -> bool:
    try:
        import urllib.request

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/callguard/status", timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def _guard_bot_running(port: int) -> bool:
    try:
        import json
        import urllib.request

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/guard/status", timeout=3) as resp:
            guard = json.loads(resp.read().decode("utf-8"))
            return bool(guard.get("bot", {}).get("running"))
    except Exception:
        return False


def _self_heal_api_available(port: int) -> bool:
    try:
        import urllib.request

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/heal/status", timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def _print_running_status(port: int, pids: list[int]) -> None:
    print(f"Monster AI + MonsterGuard already running on port {port} (PID: {', '.join(map(str, pids))}).")
    print(f"Open: http://127.0.0.1:{port}")
    print("Status: http://127.0.0.1:{0}/api/guard/status".format(port))
    print("Self-heal: http://127.0.0.1:{0}/api/heal/status".format(port))
    print("Learning: http://127.0.0.1:{0}/api/learning/status".format(port))
    try:
        import json
        import urllib.request

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/guard/status", timeout=3) as resp:
            guard = json.loads(resp.read().decode("utf-8"))
            bot = guard.get("bot", {})
            print(
                "MonsterGuard bot: ONLINE"
                if bot.get("running")
                else "MonsterGuard bot: OFFLINE"
            )
            heal = bot.get("self_heal")
            if heal:
                print(f"Self-heal loop: enabled={heal.get('enabled')} restarts={heal.get('restarts')}")
    except Exception:
        pass
    print()
    print("No restart needed (instance is healthy).")
    print("To force restart: run scripts\\stop-monsterguard.bat as Admin, then run this again.")


def _free_port(port: int) -> None:
    pids = _pids_on_port(port)
    if not pids:
        return
    healthy = _is_server_healthy(port)
    bot_ok = _guard_bot_running(port)
    heal_ok = _self_heal_api_available(port)

    if healthy and bot_ok and heal_ok:
        _print_running_status(port, pids)
        _wait_enter()
        raise SystemExit(0)
    if healthy and bot_ok and not heal_ok:
        print(f"Port {port} has old Monster AI (missing self-heal API) — restarting...")
    elif healthy and not bot_ok:
        print(f"Monster AI on port {port} but MonsterGuard bot is OFFLINE — restarting...")
    print(f"Port {port} is in use. Stopping old instance (PID: {', '.join(map(str, pids))})...")
    for pid in pids:
        subprocess.run(f"taskkill /PID {pid} /F", shell=True, check=False)
    time.sleep(1)
    if _pids_on_port(port):
        print(f"ERROR: Could not free port {port}.")
        print("Right-click scripts\\stop-monsterguard.bat -> Run as administrator")
        print("Or end python.exe (PID above) in Task Manager -> Details.")
        _wait_enter()
        raise SystemExit(1)


def main() -> int:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not TOKEN_FILE.exists():
        msg = (
            f"Missing: {TOKEN_FILE}\n"
            "Copy discord.token.local.example to discord.token.local\n"
            "Paste your Bot Token on one line (no quotes, no # comments)."
        )
        print(msg)
        LOG_FILE.write_text(msg, encoding="utf-8")
        _wait_enter()
        return 1

    lines = [
        ln.strip()
        for ln in TOKEN_FILE.read_text(encoding="utf-8-sig").splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    token = lines[0] if lines else ""
    if not token:
        msg = (
            "discord.token.local has no valid token.\n"
            "Open in Notepad, delete all lines, paste ONE line: your Bot Token only."
        )
        print(msg)
        LOG_FILE.write_text(msg, encoding="utf-8")
        _wait_enter()
        return 1

    port = _load_port()
    _free_port(port)

    lock = ROOT / "data" / "monster-ai.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    if lock.exists():
        try:
            old_pid = int(lock.read_text(encoding="utf-8").strip())
            subprocess.run(f"taskkill /PID {old_pid} /F", shell=True, check=False)
            time.sleep(1)
        except ValueError:
            pass
    lock.write_text(str(os.getpid()), encoding="utf-8")

    os.environ["MONSTER_DISCORD_TOKEN"] = token
    os.chdir(ROOT)

    print("Starting Monster AI + MonsterGuard...")
    print(f"Root: {ROOT}")
    print(f"URL:  http://127.0.0.1:{port}")
    print("Stop with Ctrl+C (do NOT close by clicking X if you want to keep running)\n")

    try:
        return subprocess.call([sys.executable, "main.py"], cwd=ROOT)
    except KeyboardInterrupt:
        return 0
    except Exception as exc:  # noqa: BLE001
        msg = f"Launch failed: {exc}"
        print(msg)
        LOG_FILE.write_text(msg, encoding="utf-8")
        _wait_enter()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())