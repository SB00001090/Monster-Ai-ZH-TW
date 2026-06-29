import type { User } from "../../drizzle/schema";

export type MemoryConversation = {
  id: number;
  userId: number;
  title: string;
  mode: "chat" | "image";
  createdAt: Date;
  updatedAt: Date;
  pythonSessionId?: string;
  characterId?: number;
};

export type MemoryMessage = {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

export type MemoryCharacter = {
  id: number;
  userId: number;
  name: string;
  description: string;
  worldview: string;
  openingLine: string;
  systemPrompt: string | null;
  isPublic: number;
  averageRating: number;
  usageCount: number;
  avatarUrl?: string | null;
  avatarKey?: string | null;
  pythonId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MemoryImage = {
  id: number;
  conversationId: number;
  userId: number;
  prompt: string;
  imageUrl: string;
  imageKey: string;
  createdAt: Date;
};

function reviveDate(value: unknown) {
  return typeof value === "string" ? new Date(value) : new Date();
}

function reviveUser(raw: Record<string, unknown>): User {
  return {
    id: Number(raw.id),
    openId: String(raw.openId),
    name: (raw.name as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    loginMethod: (raw.loginMethod as string | null) ?? null,
    role: (raw.role as User["role"]) ?? "user",
    llmConfig: (raw.llmConfig as User["llmConfig"]) ?? null,
    createdAt: reviveDate(raw.createdAt),
    updatedAt: reviveDate(raw.updatedAt),
    lastSignedIn: reviveDate(raw.lastSignedIn),
  };
}

class MemoryStore {
  private guestUsers = new Map<string, User>();
  private devUsers = new Map<string, User>();
  private conversations = new Map<number, MemoryConversation>();
  private messages = new Map<number, MemoryMessage[]>();
  private characters = new Map<number, MemoryCharacter>();
  private images = new Map<number, MemoryImage[]>();
  private llmConfigs = new Map<number, Record<string, unknown>>();
  private counters = {
    userId: 1000,
    conversation: 1,
    message: 1,
    character: 1,
    image: 1,
  };

  private mutateHandler: (() => void) | null = null;

  setMutateHandler(handler: () => void) {
    this.mutateHandler = handler;
  }

  private touch() {
    this.mutateHandler?.();
  }

  serialize() {
    return {
      counters: this.counters,
      guestUsers: [...this.guestUsers.entries()],
      devUsers: [...this.devUsers.entries()],
      conversations: [...this.conversations.entries()],
      messages: [...this.messages.entries()],
      characters: [...this.characters.entries()],
      images: [...this.images.entries()],
      llmConfigs: [...this.llmConfigs.entries()],
    };
  }

  hydrate(data: unknown) {
    if (!data || typeof data !== "object") return;
    const raw = data as Record<string, unknown>;

    if (raw.counters && typeof raw.counters === "object") {
      this.counters = { ...this.counters, ...(raw.counters as typeof this.counters) };
    }

    this.guestUsers = new Map(
      (raw.guestUsers as [string, Record<string, unknown>][] | undefined)?.map(([k, v]) => [
        k,
        reviveUser(v),
      ]) ?? []
    );
    this.devUsers = new Map(
      (raw.devUsers as [string, Record<string, unknown>][] | undefined)?.map(([k, v]) => [
        k,
        reviveUser(v),
      ]) ?? []
    );

    this.conversations = new Map(
      (raw.conversations as [number, MemoryConversation][] | undefined)?.map(([id, conv]) => [
        id,
        {
          ...conv,
          createdAt: reviveDate(conv.createdAt),
          updatedAt: reviveDate(conv.updatedAt),
        },
      ]) ?? []
    );

    this.messages = new Map(
      (raw.messages as [number, MemoryMessage[]][] | undefined)?.map(([id, msgs]) => [
        id,
        msgs.map((m) => ({ ...m, createdAt: reviveDate(m.createdAt) })),
      ]) ?? []
    );

    this.characters = new Map(
      (raw.characters as [number, MemoryCharacter][] | undefined)?.map(([id, char]) => [
        id,
        {
          ...char,
          createdAt: reviveDate(char.createdAt),
          updatedAt: reviveDate(char.updatedAt),
        },
      ]) ?? []
    );

    this.images = new Map(
      (raw.images as [number, MemoryImage[]][] | undefined)?.map(([id, imgs]) => [
        id,
        imgs.map((img) => ({ ...img, createdAt: reviveDate(img.createdAt) })),
      ]) ?? []
    );

    this.llmConfigs = new Map(
      (raw.llmConfigs as [number, Record<string, unknown>][] | undefined) ?? []
    );
  }

  allocateGuestUserId() {
    return this.counters.userId++;
  }

  getGuestUser(guestId: string) {
    return this.guestUsers.get(guestId) ?? null;
  }

  setGuestUser(guestId: string, user: User) {
    this.guestUsers.set(guestId, user);
    this.touch();
  }

  upsertDevUser(user: User) {
    this.devUsers.set(user.openId, user);
    this.touch();
  }

  getDevUserByOpenId(openId: string) {
    return this.devUsers.get(openId) ?? null;
  }

  getLLMConfig(userId: number) {
    return this.llmConfigs.get(userId) ?? null;
  }

  setLLMConfig(userId: number, config: Record<string, unknown>) {
    this.llmConfigs.set(userId, config);
    this.touch();
  }

  deleteLLMConfig(userId: number) {
    this.llmConfigs.delete(userId);
    this.touch();
  }

  createConversation(
    userId: number,
    title: string,
    mode: "chat" | "image" = "chat",
    characterId?: number
  ) {
    const id = this.counters.conversation++;
    const now = new Date();
    const conv: MemoryConversation = {
      id,
      userId,
      title,
      mode,
      createdAt: now,
      updatedAt: now,
      characterId,
    };
    this.conversations.set(id, conv);
    this.messages.set(id, []);
    this.touch();
    return conv;
  }

  listConversations(userId: number) {
    return [...this.conversations.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getConversation(id: number) {
    return this.conversations.get(id) ?? null;
  }

  deleteConversation(id: number) {
    this.conversations.delete(id);
    this.messages.delete(id);
    this.touch();
  }

  addMessage(conversationId: number, role: "user" | "assistant", content: string) {
    const id = this.counters.message++;
    const msg: MemoryMessage = {
      id,
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    const list = this.messages.get(conversationId) ?? [];
    list.push(msg);
    this.messages.set(conversationId, list);
    const conv = this.conversations.get(conversationId);
    if (conv) conv.updatedAt = new Date();
    this.touch();
    return msg;
  }

  listMessages(conversationId: number) {
    return [...(this.messages.get(conversationId) ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  deleteMessage(messageId: number) {
    for (const [convId, list] of this.messages.entries()) {
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        list.splice(idx, 1);
        this.messages.set(convId, list);
        this.touch();
        return true;
      }
    }
    return false;
  }

  setPythonSession(conversationId: number, sessionId: string) {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.pythonSessionId = sessionId;
      this.touch();
    }
  }

  getPythonSession(conversationId: number) {
    return this.conversations.get(conversationId)?.pythonSessionId;
  }

  setConversationCharacter(conversationId: number, characterId: number) {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.characterId = characterId;
      this.touch();
    }
  }

  incrementCharacterUsage(characterId: number) {
    const character = this.characters.get(characterId);
    if (!character) return;
    character.usageCount += 1;
    character.updatedAt = new Date();
    this.touch();
  }

  upsertCharacters(chars: MemoryCharacter[]) {
    for (const c of chars) this.characters.set(c.id, c);
    this.touch();
  }

  listCharacters() {
    return [...this.characters.values()];
  }

  getCharacter(id: number) {
    return this.characters.get(id) ?? null;
  }

  getCharacterByPythonId(pythonId: string) {
    return [...this.characters.values()].find((c) => c.pythonId === pythonId) ?? null;
  }

  createCharacter(data: Omit<MemoryCharacter, "id" | "createdAt" | "updatedAt">) {
    const id = this.counters.character++;
    const now = new Date();
    const character: MemoryCharacter = { ...data, id, createdAt: now, updatedAt: now };
    this.characters.set(id, character);
    this.touch();
    return character;
  }

  updateCharacter(id: number, data: Partial<MemoryCharacter>) {
    const existing = this.characters.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.characters.set(id, updated);
    this.touch();
    return updated;
  }

  deleteCharacter(id: number) {
    const deleted = this.characters.delete(id);
    if (deleted) this.touch();
    return deleted;
  }

  addImage(
    conversationId: number,
    userId: number,
    prompt: string,
    imageUrl: string,
    imageKey: string
  ) {
    const id = this.counters.image++;
    const img: MemoryImage = {
      id,
      conversationId,
      userId,
      prompt,
      imageUrl,
      imageKey,
      createdAt: new Date(),
    };
    const list = this.images.get(conversationId) ?? [];
    list.unshift(img);
    this.images.set(conversationId, list);
    this.touch();
    return img;
  }

  listImages(conversationId: number) {
    return this.images.get(conversationId) ?? [];
  }
}

export const memoryStore = new MemoryStore();