import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Chat Router", () => {
  it("should create a new conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chat.createConversation({
      title: "Test Conversation",
      mode: "chat",
    });

    expect(result).toBeDefined();
  });

  it("should add a message to a conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation first
    const conv = await caller.chat.createConversation({
      title: "Test",
      mode: "chat",
    });

    const convId = (conv as any).id;
    expect(convId).toBeDefined();
    if (!convId) throw new Error('Failed to create conversation');

    // Add a message
    const result = await caller.chat.addMessage({
      conversationId: convId,
      role: "user",
      content: "Hello, MonsterAi!",
    });

    expect(result).toBeDefined();
  });

  it("should get user conversations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const conversations = await caller.chat.getConversations();
    expect(Array.isArray(conversations)).toBe(true);
  });

  it("should get messages from a conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const conv = await caller.chat.createConversation({
      title: "Test",
      mode: "chat",
    });

    const convId = (conv as any).id;
    expect(convId).toBeDefined();
    if (!convId) throw new Error('Failed to create conversation');

    // Add a message
    await caller.chat.addMessage({
      conversationId: convId,
      role: "user",
      content: "Test message",
    });

    // Get messages
    const messages = await caller.chat.getMessages({
      conversationId: convId,
    });

    expect(Array.isArray(messages)).toBe(true);
  });

  it("should delete a message", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation and message
    const conv = await caller.chat.createConversation({
      title: "Test",
      mode: "chat",
    });

    const convId = (conv as any).id;
    expect(convId).toBeDefined();
    if (!convId) throw new Error('Failed to create conversation');

    const msg = await caller.chat.addMessage({
      conversationId: convId,
      role: "user",
      content: "Test message",
    });

    const msgId = (msg as any).insertId || 1;

    // Delete the message
    const result = await caller.chat.deleteMessage({
      messageId: msgId,
    });

    expect(result).toBeDefined();
  });

  it("should delete a conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const conv = await caller.chat.createConversation({
      title: "Test",
      mode: "chat",
    });

    const convId = (conv as any).id;
    expect(convId).toBeDefined();
    if (!convId) throw new Error('Failed to create conversation');

    // Delete the conversation
    const result = await caller.chat.deleteConversation({
      conversationId: convId,
    });

    expect(result).toBeDefined();
  });
});

describe("Image Router", () => {
  it("should get gallery images for a conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const conv = await caller.chat.createConversation({
      title: "Image Test",
      mode: "image",
    });

    const convId = (conv as any).id;
    expect(convId).toBeDefined();
    if (!convId) throw new Error('Failed to create conversation');

    // Get gallery
    const images = await caller.image.getGallery({
      conversationId: convId,
    });

    expect(Array.isArray(images)).toBe(true);
  });
});

describe("Auth Router", () => {
  it("should get current user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.id).toBe(1);
  });

  it("should logout user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
