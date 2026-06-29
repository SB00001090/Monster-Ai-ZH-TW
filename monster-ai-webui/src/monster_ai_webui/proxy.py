"""HTTP and WebSocket reverse proxy helpers."""
from __future__ import annotations

import asyncio
import os
from typing import Iterable
from urllib.parse import urlparse

import httpx
import websockets
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

router = APIRouter(tags=["proxy"])

_SKIP_REQ_HEADERS = frozenset(
    {"host", "content-length", "transfer-encoding", "connection"}
)
_SKIP_RESP_HEADERS = frozenset(
    {"content-encoding", "transfer-encoding", "connection", "content-length"}
)
_PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


def monster_api_url() -> str:
    return os.environ.get("MONSTER_API_URL", "http://127.0.0.1:7861").rstrip("/")


def node_api_url() -> str:
    return os.environ.get("NODE_API_URL", "http://127.0.0.1:3000").rstrip("/")


def _filter_headers(
    headers: Iterable[tuple[str, str]], skip: frozenset[str]
) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in headers:
        if key.lower() not in skip:
            out[key] = value
    return out


async def proxy_http(request: Request, base: str, target_path: str) -> Response:
    url = f"{base.rstrip('/')}{target_path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"
    body = await request.body()
    headers = _filter_headers(request.headers.items(), _SKIP_REQ_HEADERS)
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=False) as client:
        upstream = await client.request(
            request.method,
            url,
            headers=headers,
            content=body if body else None,
        )
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=_filter_headers(upstream.headers.items(), _SKIP_RESP_HEADERS),
        media_type=upstream.headers.get("content-type"),
    )


def _http_to_ws_url(http_url: str, path: str) -> str:
    parsed = urlparse(http_url)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    host = parsed.netloc or parsed.path
    return f"{scheme}://{host}{path}"


async def _relay_websockets(client: WebSocket, upstream_url: str) -> None:
    await client.accept()
    try:
        async with websockets.connect(upstream_url) as upstream:
            async def client_to_upstream() -> None:
                try:
                    while True:
                        msg = await client.receive()
                        if msg["type"] == "websocket.disconnect":
                            break
                        if "text" in msg:
                            await upstream.send(msg["text"])
                        elif "bytes" in msg:
                            await upstream.send(msg["bytes"])
                except WebSocketDisconnect:
                    pass

            async def upstream_to_client() -> None:
                try:
                    async for message in upstream:
                        if isinstance(message, bytes):
                            await client.send_bytes(message)
                        else:
                            await client.send_text(message)
                except Exception:
                    pass

            await asyncio.gather(client_to_upstream(), upstream_to_client())
    finally:
        if client.client_state != WebSocketState.DISCONNECTED:
            await client.close()


@router.api_route("/api/trpc", methods=_PROXY_METHODS)
@router.api_route("/api/trpc/{path:path}", methods=_PROXY_METHODS)
async def proxy_trpc(request: Request, path: str = "") -> Response:
    suffix = f"/{path}" if path else ""
    return await proxy_http(request, node_api_url(), f"/api/trpc{suffix}")


@router.api_route("/api/oauth", methods=_PROXY_METHODS)
@router.api_route("/api/oauth/{path:path}", methods=_PROXY_METHODS)
async def proxy_oauth(request: Request, path: str = "") -> Response:
    suffix = f"/{path}" if path else ""
    return await proxy_http(request, node_api_url(), f"/api/oauth{suffix}")


@router.api_route("/monster-storage", methods=_PROXY_METHODS)
@router.api_route("/monster-storage/{path:path}", methods=_PROXY_METHODS)
async def proxy_storage(request: Request, path: str = "") -> Response:
    suffix = f"/{path}" if path else ""
    return await proxy_http(request, node_api_url(), f"/monster-storage{suffix}")


@router.api_route("/api", methods=_PROXY_METHODS)
@router.api_route("/api/{path:path}", methods=_PROXY_METHODS)
async def proxy_monster_api(request: Request, path: str = "") -> Response:
    if path.startswith("trpc") or path.startswith("oauth"):
        return await proxy_http(request, node_api_url(), f"/api/{path}" if path else "/api")
    suffix = f"/{path}" if path else ""
    return await proxy_http(request, monster_api_url(), f"/api{suffix}")


@router.api_route("/downloads", methods=_PROXY_METHODS)
@router.api_route("/downloads/{path:path}", methods=_PROXY_METHODS)
async def proxy_downloads(request: Request, path: str = "") -> Response:
    suffix = f"/{path}" if path else ""
    return await proxy_http(request, monster_api_url(), f"/downloads{suffix}")


@router.api_route("/health", methods=["GET"])
@router.api_route("/status", methods=["GET"])
@router.api_route("/config", methods=["GET"])
async def proxy_misc(request: Request) -> Response:
    return await proxy_http(request, monster_api_url(), request.url.path)


@router.websocket("/ws/{path:path}")
async def proxy_ws(websocket: WebSocket, path: str) -> None:
    target = _http_to_ws_url(monster_api_url(), f"/ws/{path}")
    await _relay_websockets(websocket, target)


@router.websocket("/api/security/ws/alerts")
async def proxy_security_ws(websocket: WebSocket) -> None:
    target = _http_to_ws_url(monster_api_url(), "/api/security/ws/alerts")
    await _relay_websockets(websocket, target)