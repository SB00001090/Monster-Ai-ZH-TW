import { z } from "zod";
import * as db from "../db";
import { memoryStore } from "../_core/memoryStore";
import {
  createPythonSession,
  sendPythonMessage,
} from "../_core/pythonBridge";
import { protectedProcedure, router } from "../_core/trpc";

type CharacterRecord = {
  id: number;
  name: string;
  description: string;
  worldview: string;
  openingLine: string;
  avatarUrl?: string | null;
  averageRating: number;
  usageCount: number;
  pythonId?: string | null;
};

function characterPreview(character: CharacterRecord) {
  return {
    id: character.id,
    name: character.name,
    description: character.description,
    worldview: character.worldview,
    openingLine: character.openingLine,
    avatarUrl: character.avatarUrl ?? null,
    averageRating: character.averageRating,
    usageCount: character.usageCount,
  };
}

function enrichConversation(conv: ReturnType<typeof memoryStore.getConversation>) {
  if (!conv) return null;
  const msgs = memoryStore.listMessages(conv.id);
  const character = conv.characterId ? memoryStore.getCharacter(conv.characterId) : null;
  return {
    ...conv,
    messageCount: msgs.length,
    lastMessage: msgs.at(-1)?.content?.slice(0, 100) ?? null,
    character: character ? characterPreview(character) : null,
  };
}

function resolveCharacterForConversation(conversationId: number, characterId?: number) {
  const conv = memoryStore.getConversation(conversationId);
  const resolvedId = characterId ?? conv?.characterId;
  if (!resolvedId) return { characterId: undefined, pythonId: undefined, character: null };

  const character = memoryStore.getCharacter(resolvedId);
  return {
    characterId: resolvedId,
    pythonId: character?.pythonId,
    character,
  };
}

export const chatRouter = router({
  createConversation: protectedProcedure
    .input(
      z.object({
        title: z.string().default("New Conversation"),
        mode: z.enum(["chat", "image"]).default("chat"),
        characterId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        const conv = await db.createConversation(
          ctx.user!.id,
          input.title,
          input.mode,
          input.characterId
        );
        let openingMessage = null;
        if (input.characterId) {
          const character = await db.getCharacterForChat(input.characterId, ctx.user!.id);
          if (character?.openingLine?.trim()) {
            await db.addMessage(conv.id, "assistant", character.openingLine);
            openingMessage = {
              id: Date.now(),
              role: "assistant" as const,
              content: character.openingLine,
            };
          }
        }
        return { ...conv, openingMessage };
      }

      const conv = memoryStore.createConversation(
        ctx.user!.id,
        input.title,
        input.mode,
        input.characterId
      );

      let openingMessage = null;
      if (input.characterId) {
        const character = memoryStore.getCharacter(input.characterId);
        if (character?.openingLine?.trim()) {
          openingMessage = memoryStore.addMessage(
            conv.id,
            "assistant",
            character.openingLine
          );
        }
      }

      return { ...conv, openingMessage };
    }),

  getConversations: protectedProcedure.query(async ({ ctx }) => {
    if (process.env.DATABASE_URL) {
      return db.getUserConversationsEnriched(ctx.user!.id);
    }
    return memoryStore
      .listConversations(ctx.user!.id)
      .map((conv) => enrichConversation(conv)!);
  }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        const conv = await db.getConversation(input.conversationId, ctx.user!.id);
        if (!conv) return null;
        const msgs = await db.getConversationMessages(conv.id);
        const character = conv.characterId
          ? await db.getCharacterForChat(conv.characterId, ctx.user!.id)
          : null;
        return {
          ...conv,
          messageCount: msgs.length,
          lastMessage: msgs.at(-1)?.content?.slice(0, 100) ?? null,
          character: character ? characterPreview(character) : null,
        };
      }

      const conv = memoryStore.getConversation(input.conversationId);
      if (!conv || conv.userId !== ctx.user!.id) return null;
      return enrichConversation(conv);
    }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        return db.getConversationMessages(input.conversationId);
      }
      return memoryStore.listMessages(input.conversationId);
    }),

  addMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        return db.addMessage(input.conversationId, input.role, input.content);
      }
      return memoryStore.addMessage(input.conversationId, input.role, input.content);
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: z.string().min(1),
        characterId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        const conv = await db.getConversation(input.conversationId, ctx.user!.id);
        if (!conv) throw new Error("Conversation not found");

        const resolvedId = input.characterId ?? conv.characterId ?? undefined;
        let character: CharacterRecord | null = null;
        let pythonId: string | undefined;

        if (resolvedId) {
          character = (await db.getCharacterForChat(resolvedId, ctx.user!.id)) ?? null;
          pythonId = character?.pythonId ?? undefined;
          const wasUnbound = !conv.characterId;
          if (wasUnbound) {
            await db.updateConversation(input.conversationId, ctx.user!.id, {
              characterId: resolvedId,
            });
          }
          await db.incrementCharacterUsage(resolvedId);
          const updatedChar = await db.getCharacterForChat(resolvedId, ctx.user!.id);
          const existingAnalytics = await db.getCharacterAnalytics(resolvedId, ctx.user!.id);
          const prevConvCount = existingAnalytics[0]?.conversationCount ?? 0;
          await db.updateCharacterAnalytics(resolvedId, ctx.user!.id, {
            messageCount: updatedChar?.usageCount ?? 0,
            lastUsedAt: new Date(),
            conversationCount: wasUnbound ? prevConvCount + 1 : prevConvCount,
          });
        }

        await db.addMessage(input.conversationId, "user", input.message);

        let pythonSessionId = conv.pythonSessionId ?? undefined;
        if (!pythonSessionId) {
          const session = await createPythonSession(conv.title ?? "Web Chat", pythonId);
          pythonSessionId = session.id;
          await db.updateConversation(input.conversationId, ctx.user!.id, {
            pythonSessionId,
          });
        }

        const reply = await sendPythonMessage(pythonSessionId, input.message, pythonId);
        await db.addMessage(input.conversationId, "assistant", reply.content);

        return {
          message: reply.content,
          role: "assistant" as const,
          messageId: Date.now(),
          characterName: character?.name ?? reply.character_name,
        };
      }

      const { characterId, pythonId, character } = resolveCharacterForConversation(
        input.conversationId,
        input.characterId
      );

      if (characterId) {
        memoryStore.setConversationCharacter(input.conversationId, characterId);
        memoryStore.incrementCharacterUsage(characterId);
      }

      memoryStore.addMessage(input.conversationId, "user", input.message);

      let pythonSessionId = memoryStore.getPythonSession(input.conversationId);

      if (!pythonSessionId) {
        const conv = memoryStore.getConversation(input.conversationId);
        const session = await createPythonSession(conv?.title ?? "Web Chat", pythonId);
        pythonSessionId = session.id;
        memoryStore.setPythonSession(input.conversationId, pythonSessionId);
      }

      const reply = await sendPythonMessage(pythonSessionId, input.message, pythonId);

      const assistantMessage = memoryStore.addMessage(
        input.conversationId,
        "assistant",
        reply.content
      );

      return {
        message: reply.content,
        role: "assistant" as const,
        messageId: assistantMessage.id,
        characterName: character?.name ?? reply.character_name,
      };
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        await db.deleteMessage(input.messageId);
      } else {
        memoryStore.deleteMessage(input.messageId);
      }
      return { success: true };
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        await db.deleteConversation(input.conversationId);
      } else {
        memoryStore.deleteConversation(input.conversationId);
      }
      return { success: true };
    }),
});