"""Sentry Issue → Guardian errors → Dify workflow → optional code patch."""
from __future__ import annotations

import os
from typing import Any

from monster_ai.config import IntegrationsSettings


def _extract_issue(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    issue = data.get("issue") if isinstance(data.get("issue"), dict) else {}
    event = payload.get("event") if isinstance(payload.get("event"), dict) else {}

    title = (
        issue.get("title")
        or event.get("title")
        or payload.get("message")
        or "Sentry alert"
    )
    culprit = issue.get("culprit") or event.get("culprit") or ""
    permalink = issue.get("permalink") or issue.get("web_url") or ""
    issue_id = issue.get("id") or payload.get("id") or ""
    return {
        "title": str(title),
        "culprit": str(culprit),
        "permalink": str(permalink),
        "issue_id": str(issue_id),
        "action": str(payload.get("action") or "alert"),
    }


class SentryOrchestrator:
    def __init__(self, settings: IntegrationsSettings) -> None:
        self.settings = settings

    def _webhook_secret(self) -> str:
        return os.environ.get(self.settings.sentry_webhook_secret_env, "")

    def verify_secret(self, header_value: str) -> bool:
        secret = self._webhook_secret()
        if not secret:
            return True
        return header_value == secret

    async def handle(
        self,
        payload: dict[str, Any],
        *,
        guardian_svc: Any,
        dify_bridge: Any | None,
        code_repair: Any | None,
    ) -> dict[str, Any]:
        issue = _extract_issue(payload)
        error_text = f"{issue['title']}\n{issue['culprit']}".strip()
        if issue["permalink"]:
            error_text = f"{error_text}\n{issue['permalink']}"

        guardian_result = await guardian_svc.report_error(
            error_type="SentryIssue",
            message=issue["title"],
            stack=issue["culprit"] or None,
            context=f"sentry:{issue['issue_id']} action={issue['action']}",
            source="sentry",
            jam_url=issue["permalink"] or None,
            incident_id=int(issue["issue_id"]) if str(issue["issue_id"]).isdigit() else None,
        )

        dify_result: dict[str, Any] | None = None
        if dify_bridge is not None:
            dify_result = await dify_bridge.run_error_workflow(
                error_context=error_text,
                issue_id=issue["issue_id"],
                quality_score=0.0,
            )

        patch_result: dict[str, Any] | None = None
        if (
            self.settings.sentry_auto_patch_enabled
            and code_repair is not None
            and guardian_result.get("fix_suggestion")
        ):
            repair = await code_repair.attempt_fix(error_text)
            patch_result = {
                "success": repair.success,
                "message": repair.message,
                "branch": repair.branch,
                "files_changed": repair.files_changed or [],
            }
            await guardian_svc.report_error(
                error_type="AutoPatchResult",
                message=repair.message,
                context=f"sentry_patch issue={issue['issue_id']}",
                source="code_repair_agent",
                auto_fix_action="sentry_auto_patch",
                auto_fix_result=repair.message,
            )

        return {
            "ok": True,
            "issue": issue,
            "guardian": guardian_result,
            "dify": dify_result,
            "patch": patch_result,
        }