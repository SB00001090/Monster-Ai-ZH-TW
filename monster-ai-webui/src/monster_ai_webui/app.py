"""FastAPI Web UI gateway application."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from monster_ai_webui.proxy import router as proxy_router
from monster_ai_webui.static_resolver import resolve_web_root


class SPAStaticFiles(StaticFiles):
    """Serve SPA assets; unknown routes fall back to index.html."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            leaf = path.rsplit("/", 1)[-1] if path else ""
            if leaf and "." in leaf and not leaf.startswith("."):
                raise
            return await super().get_response("index.html", scope)


def create_app(web_root_override: str = "") -> FastAPI:
    static_dir, mode = resolve_web_root(web_root_override)
    app = FastAPI(title="Monster AI Web UI", version="0.1.0")
    app.state.ui_mode = mode
    app.state.static_dir = str(static_dir)

    app.include_router(proxy_router)

    @app.get("/monsterai-security.html")
    async def security_html():
        from fastapi.responses import FileResponse

        for candidate in (
            static_dir / "monsterai-security.html",
            Path(static_dir).parent / "fallback" / "monsterai-security.html",
        ):
            if candidate.is_file():
                return FileResponse(candidate, media_type="text/html; charset=utf-8")
        raise StarletteHTTPException(404)

    app.mount("/", SPAStaticFiles(directory=str(static_dir), html=True), name="static")
    return app