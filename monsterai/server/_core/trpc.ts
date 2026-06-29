import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { detectISP, isISPBlocked, getISPRestrictionMessage } from "../isp";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Developer procedure - allows both admin and developer roles
export const developerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'admin' && ctx.user.role !== 'developer')) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Developer access required" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ISP restriction middleware
const checkISPRestriction = t.middleware(async opts => {
  const { ctx, next } = opts;
  
  // Handle both production and test environments
  const ipAddress = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0] || ctx.req.socket?.remoteAddress || "127.0.0.1";
  const userAgent = ctx.req.headers["user-agent"] as string;
  const isp = detectISP(ipAddress, userAgent);
  
  if (isISPBlocked(isp)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getISPRestrictionMessage(isp),
    });
  }
  
  return next({
    ctx: {
      ...ctx,
      isp,
    },
  });
});

export const ispProtectedProcedure = protectedProcedure.use(checkISPRestriction);

import { getVPNDetectionMessage } from "./vpnDetection";
import { getChinaDetectionMessage } from "./chinaDetection";

// VPN detection middleware
const checkVPNAccess = t.middleware(async opts => {
  const { ctx, next } = opts;
  
  if (ctx.vpnCheck && !ctx.vpnCheck.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getVPNDetectionMessage(),
    });
  }
  
  return next({ ctx });
});

export const vpnProtectedProcedure = protectedProcedure.use(checkVPNAccess);

// China detection middleware
const checkChinaAccess = t.middleware(async opts => {
  const { ctx, next } = opts;
  
  if (ctx.chinaCheck && ctx.chinaCheck.blocked) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ctx.chinaCheck.message,
    });
  }
  
  return next({ ctx });
});

export const chinaProtectedProcedure = protectedProcedure.use(checkChinaAccess);

// Combined security middleware (VPN + China + ISP)
export const secureProtectedProcedure = protectedProcedure
  .use(checkISPRestriction)
  .use(checkVPNAccess)
  .use(checkChinaAccess);

import { isTemporaryAccountExpired, getTemporaryAccountRestrictionsMessage } from "./temporaryAccounts";

// Temporary account check middleware
const checkTemporaryAccountExpiration = t.middleware(async opts => {
  const { ctx, next } = opts;
  
  if (ctx.user && isTemporaryAccountExpired(ctx.user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your temporary account has expired. Please upgrade to continue.",
    });
  }
  
  return next({ ctx });
});

export const tempAccountProtectedProcedure = protectedProcedure.use(checkTemporaryAccountExpiration);
