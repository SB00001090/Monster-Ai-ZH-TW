import type { ErrorIncident } from "./errorIncidentStore";
import { updateIncident } from "./errorIncidentStore";

export type ClientAction =
  | { type: "guest" }
  | { type: "reload" }
  | { type: "redirect"; target: string };

export type AutoFixResult = {
  fixAttempted: boolean;
  fixAction: string;
  fixResult: string;
  clientAction?: ClientAction;
  status: "resolved" | "failed" | "open";
};

const PYTHON_API_URL =
  process.env.PYTHON_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:7860";

const healAttempts = new Map<number, number>();

function classify(message: string, context: string): string {
  const blob = `${message} ${context}`.toLowerCase();
  if (
    blob.includes("econnrefused") ||
    blob.includes("unexpected end of json") ||
    blob.includes("connect") && blob.includes("3000") ||
    blob.includes("auth.me")
  ) {
    if (blob.includes("unauthorized") || blob.includes("401")) {
      return "guest_fallback";
    }
    return "api_retry";
  }
  if (
    blob.includes("invalid url") ||
    blob.includes("oauth") ||
    blob.includes("failed to construct 'url'")
  ) {
    return "route_login";
  }
  if (
    blob.includes("unauthorized") ||
    blob.includes("401") ||
    blob.includes("auth.me")
  ) {
    return "guest_fallback";
  }
  if (blob.includes("failed to fetch") || blob.includes(" 500")) {
    return "trigger_heal";
  }
  return "log_only";
}

async function triggerPythonHeal(): Promise<string> {
  try {
    const statusRes = await fetch(`${PYTHON_API_URL}/api/heal/status`, {
      signal: AbortSignal.timeout(8000),
    });
    const statusText = statusRes.ok
      ? `heal status ${statusRes.status}`
      : `heal status failed ${statusRes.status}`;

    const triggerRes = await fetch(`${PYTHON_API_URL}/api/heal/trigger`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
    });
    const body = triggerRes.ok ? await triggerRes.text() : "";
    return `${statusText}; trigger ${triggerRes.status} ${body.slice(0, 200)}`;
  } catch (error) {
    return `heal trigger error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function reportToGuardian(
  incident: ErrorIncident,
  fix: AutoFixResult,
): Promise<void> {
  const body = {
    error_type: incident.errorType,
    message: incident.message,
    stack: incident.stack,
    context: incident.context,
    source: incident.source,
    incident_id: incident.id,
    auto_fix_action: fix.fixAction,
    auto_fix_result: fix.fixResult,
    jam_url: process.env.JAM_REPLAY_URL || undefined,
  };
  try {
    await fetch(`${PYTHON_API_URL}/api/guardian/errors/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // non-fatal — client may also dual-write
  }
}

export async function runAutoFix(incident: ErrorIncident): Promise<AutoFixResult> {
  const action = classify(incident.message, incident.context ?? "");
  await updateIncident(incident.id, { status: "fixing", fixAction: action });

  let fixResult = "";
  let clientAction: ClientAction | undefined;
  let status: AutoFixResult["status"] = "open";

  switch (action) {
    case "api_retry":
      fixResult = "Marked API degraded; suggest client reload";
      clientAction = { type: "reload" };
      status = "resolved";
      break;
    case "guest_fallback":
      fixResult = "Suggest guest mode fallback";
      clientAction = { type: "guest" };
      status = "resolved";
      break;
    case "route_login":
      fixResult = "Redirect to login page";
      clientAction = { type: "redirect", target: "/login" };
      status = "resolved";
      break;
    case "trigger_heal": {
      const attempts = healAttempts.get(incident.id) ?? 0;
      if (attempts >= 3) {
        fixResult = "Heal circuit breaker open (max 3/hour per incident)";
        status = "failed";
        break;
      }
      healAttempts.set(incident.id, attempts + 1);
      fixResult = await triggerPythonHeal();
      clientAction = { type: "reload" };
      status = fixResult.includes("error") ? "failed" : "resolved";
      break;
    }
    default:
      fixResult = "Logged for review";
      status = "open";
      break;
  }

  await updateIncident(incident.id, {
    status,
    fixAction: action,
    fixResult,
  });

  const result: AutoFixResult = {
    fixAttempted: action !== "log_only",
    fixAction: action,
    fixResult,
    clientAction,
    status,
  };

  await reportToGuardian(incident, result);
  return result;
}