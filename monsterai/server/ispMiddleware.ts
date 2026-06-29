/**
 * ISP Restriction Middleware for tRPC
 * Checks user's ISP and enforces access restrictions
 */

import { TRPCError } from "@trpc/server";
import { detectISP, isISPBlocked, getISPRestrictionMessage } from "./isp";

/**
 * Extract IP address from request headers
 */
export function extractIPAddress(headers: Record<string, string | string[] | undefined>): string | undefined {
  // Check common proxy headers first
  const forwardedFor = headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(",")[0].trim();
  }

  const clientIP = headers["x-client-ip"];
  if (clientIP) {
    return Array.isArray(clientIP) ? clientIP[0] : clientIP;
  }

  const realIP = headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  return undefined;
}

/**
 * ISP restriction middleware for tRPC
 */
export function createISPRestrictionMiddleware() {
  return async (opts: any) => {
    const { ctx, next } = opts;

    // Skip ISP check for admin users
    if (ctx.user?.role === "admin") {
      return next();
    }

    // Extract IP address from request
    const ipAddress = extractIPAddress(ctx.headers || {});
    const userAgent = ctx.headers?.["user-agent"] as string | undefined;

    // Detect ISP
    const isp = detectISP(ipAddress, userAgent);

    // Check if ISP is blocked
    if (isISPBlocked(isp)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getISPRestrictionMessage(isp),
      });
    }

    // Store ISP info in context for later use
    ctx.isp = isp;

    return next();
  };
}
