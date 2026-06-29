"""Backend health probes."""
from __future__ import annotations

import json
import socket

import httpx


def port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1.5):
            return True
    except OSError:
        return False


def probe_monster_api(base_url: str) -> bool:
    try:
        r = httpx.get(f"{base_url.rstrip('/')}/health", timeout=3)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False


def probe_node_api(base_url: str) -> bool:
    host = base_url.replace("http://", "").replace("https://", "")
    if ":" in host:
        host, port_s = host.split(":", 1)
        port = int(port_s.split("/")[0])
    else:
        port = 3000
    if not port_open(host or "127.0.0.1", port):
        return False
    try:
        r = httpx.get(
            f"{base_url.rstrip('/')}/api/trpc/auth.me",
            params={"batch": "1", "input": json.dumps({"0": {"json": None}})},
            timeout=3,
        )
        return r.status_code == 200 and bool(r.text.strip())
    except Exception:
        return False