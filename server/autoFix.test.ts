import { describe, expect, it, beforeEach } from "vitest";
import { runAutoFix } from "./_core/autoFixEngine";
import {
  fingerprintError,
  resetIncidentStoreForTests,
  upsertIncident,
} from "./_core/errorIncidentStore";

describe("autoFix engine", () => {
  beforeEach(async () => {
    await resetIncidentStoreForTests();
  });

  it("fingerprints errors consistently", () => {
    const a = fingerprintError("Error", "boom", "at line 1");
    const b = fingerprintError("Error", "boom", "at line 1");
    const c = fingerprintError("Error", "other", "at line 1");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("dedupes incidents by fingerprint", async () => {
    const first = await upsertIncident({
      source: "ui",
      errorType: "Error",
      message: "Invalid URL",
      context: "const.ts",
    });
    const second = await upsertIncident({
      source: "ui",
      errorType: "Error",
      message: "Invalid URL",
      context: "const.ts",
    });
    expect(second.id).toBe(first.id);
    expect(second.count).toBe(2);
  });

  it("maps oauth invalid url to route_login", async () => {
    const incident = await upsertIncident({
      source: "ui",
      errorType: "Error",
      message: "Failed to construct 'URL': Invalid URL",
      context: "getLoginUrl",
    });
    const fix = await runAutoFix(incident);
    expect(fix.fixAction).toBe("route_login");
    expect(fix.clientAction).toEqual({ type: "redirect", target: "/login" });
  });

  it("maps auth errors to guest_fallback", async () => {
    const incident = await upsertIncident({
      source: "trpc",
      errorType: "TRPCClientError",
      message: "UNAUTHORIZED auth.me",
      context: "auth.me",
    });
    const fix = await runAutoFix(incident);
    expect(fix.fixAction).toBe("guest_fallback");
    expect(fix.clientAction).toEqual({ type: "guest" });
  });

  it("maps connection errors to api_retry", async () => {
    const incident = await upsertIncident({
      source: "trpc",
      errorType: "TRPCClientError",
      message: "Unexpected end of JSON input",
      context: "auth.me",
    });
    const fix = await runAutoFix(incident);
    expect(fix.fixAction).toBe("api_retry");
    expect(fix.clientAction).toEqual({ type: "reload" });
  });
});