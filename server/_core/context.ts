import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { sdk } from "./sdk";
import { memoryStore } from "./memoryStore";

export type TrpcContext = {
  user: User | null;
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  guestId?: string;
};

async function resolveGuestUser(guestId: string): Promise<User> {
  const existing = memoryStore.getGuestUser(guestId);
  if (existing) return existing;

  const user: User = {
    id: memoryStore.allocateGuestUserId(),
    openId: guestId,
    name: "Guest",
    email: null,
    loginMethod: "guest",
    role: "user",
    llmConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  memoryStore.setGuestUser(guestId, user);
  return user;
}

async function resolveSessionUser(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<TrpcContext> {
  const guestHeader = req.headers["x-guest-id"];
  const guestId =
    typeof guestHeader === "string" && guestHeader.startsWith("guest_")
      ? guestHeader
      : undefined;

  let user = await resolveSessionUser(req);

  if (!user && guestId) {
    user = await resolveGuestUser(guestId);
  }

  if (!user && !process.env.DATABASE_URL) {
    const cookie = req.headers.cookie ?? "";
    if (!cookie.includes(COOKIE_NAME)) {
      user = await resolveGuestUser(guestId ?? "guest_default");
    }
  }

  return { user, req, res, guestId };
}