"""MonsterCallGuard REST API for mobile app integration."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/callguard", tags=["callguard"])


@router.get("/status")
async def callguard_status(request: Request) -> dict:
    cg = getattr(request.app.state, "callguard", None)
    if not cg:
        return {"enabled": False}
    return cg.to_dict()


@router.post("/analyze")
async def analyze_call(request: Request, body: dict) -> dict:
    cg = request.app.state.callguard
    if not cg.state.enabled:
        raise HTTPException(503, "CallGuard disabled")
    number = str(body.get("number", ""))
    display = str(body.get("display_name", ""))
    deep = bool(body.get("deep", False))
    result = await cg.analyze_call(number, display_name=display, deep=deep)
    out = result.to_dict()
    if result.reject and cg.settings.report_enabled:
        out["report"] = cg.submit_report(number, result)
    return out


@router.get("/threat-db")
async def threat_db(request: Request) -> dict:
    cg = request.app.state.callguard
    data = cg.get_threat_db()
    from fastapi.responses import JSONResponse

    return JSONResponse(
        content=data,
        headers={"X-Threat-DB-Version": str(data.get("version", "unknown"))},
    )


@router.get("/app-manifest")
async def app_manifest(request: Request) -> dict:
    cg = request.app.state.callguard
    settings = request.app.state.settings
    apk_url = getattr(settings.protection.callguard, "apk_download_url", "")
    return cg.app_manifest(apk_url=apk_url or "")


@router.post("/token")
async def client_token(request: Request) -> dict:
    cg = request.app.state.callguard
    token, expires = cg.issue_client_token()
    return {"token": token, "expires_at": expires}


@router.get("/reports")
async def list_reports(request: Request, limit: int = 20) -> dict:
    cg = getattr(request.app.state, "callguard", None)
    if not cg:
        return {"reports": []}
    return {"reports": cg.recent_reports(limit)}


@router.post("/report")
async def submit_report(request: Request, body: dict) -> dict:
    cg = request.app.state.callguard
    from monster_ai.protection.callguard.rules import CallScoreResult

    result = CallScoreResult(
        score=int(body.get("score", 0)),
        category=str(body.get("category", "scam_suspicious")),
        signals=list(body.get("signals", [])),
    )
    number = str(body.get("number", "unknown"))
    device_contact = body.get("device_contact")
    if isinstance(device_contact, dict):
        report = cg.submit_report(number, result, device_contact=device_contact)
    else:
        report = cg.submit_report(number, result)
    return {"ok": True, "report": report}