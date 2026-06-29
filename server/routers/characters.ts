import { z } from "zod";
import * as db from "../db";
import { DEFAULT_CHARACTER_TEMPLATES } from "../data/characterTemplates";
import { memoryStore } from "../_core/memoryStore";
import {
  deletePythonCharacter,
  generatePythonPortrait,
  getPythonCharacter,
  importPythonCharacter,
  listPythonCharacters,
  toCharacterCard,
  uploadPythonCharacter,
} from "../_core/pythonBridge";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

async function syncPythonCharacterToDb(
  item: { id: string; name: string; avatar_url?: string },
  userId: number
) {
  let description = "";
  let worldview = "";
  let openingLine = "";
  let systemPrompt: string | null = null;
  try {
    const full = await getPythonCharacter(item.id);
    description = full.description ?? full.personality ?? "";
    worldview = full.scenario ?? "";
    openingLine = full.first_mes ?? "";
    systemPrompt = full.system_prompt ?? null;
  } catch {
    description = item.name;
  }

  const payload = {
    userId,
    name: item.name,
    description,
    worldview,
    openingLine,
    systemPrompt,
    isPublic: userId === 0 ? 1 : 0,
    averageRating: 0,
    usageCount: 0,
    avatarUrl: item.avatar_url ?? null,
    avatarKey: null as string | null,
    pythonId: item.id,
  };

  const existing = await db.getCharacterByPythonIdGlobal(item.id);
  if (existing) {
    await db.updateCharacter(existing.id, existing.userId, {
      name: payload.name,
      description: payload.description,
      worldview: payload.worldview,
      openingLine: payload.openingLine,
      systemPrompt: payload.systemPrompt,
      avatarUrl: payload.avatarUrl ?? existing.avatarUrl,
      pythonId: item.id,
    });
    return (await db.getCharacterByIdAny(existing.id))!;
  }

  const { id } = await db.createCharacter(payload);
  return { id, ...payload };
}

async function mapPythonCharacter(item: { id: string; name: string; avatar_url?: string }, userId: number) {
  let description = "";
  let worldview = "";
  let openingLine = "";
  let systemPrompt: string | null = null;
  try {
    const full = await getPythonCharacter(item.id);
    description = full.description ?? full.personality ?? "";
    worldview = full.scenario ?? "";
    openingLine = full.first_mes ?? "";
    systemPrompt = full.system_prompt ?? null;
  } catch {
    description = item.name;
  }

  const existing = memoryStore.listCharacters().find((c) => c.pythonId === item.id);
  if (existing) {
    return memoryStore.updateCharacter(existing.id, {
      name: item.name,
      description,
      worldview,
      openingLine,
      systemPrompt,
      avatarUrl: item.avatar_url ?? existing.avatarUrl ?? null,
    })!;
  }

  return memoryStore.createCharacter({
    userId,
    name: item.name,
    description,
    worldview,
    openingLine,
    systemPrompt,
    isPublic: 1,
    averageRating: 0,
    usageCount: 0,
    avatarUrl: item.avatar_url ?? null,
    avatarKey: null,
    pythonId: item.id,
  });
}

async function syncFromPython(userId: number) {
  const remote = await listPythonCharacters();
  const mapped = [];
  for (const item of remote) {
    if (process.env.DATABASE_URL) {
      mapped.push(await syncPythonCharacterToDb(item, userId));
    } else {
      mapped.push(await mapPythonCharacter(item, userId));
    }
  }
  return mapped;
}

async function pushToPython(input: {
  id?: string;
  name: string;
  description: string;
  worldview: string;
  openingLine: string;
  systemPrompt?: string | null;
}) {
  const imported = await importPythonCharacter(toCharacterCard(input));
  return imported.id;
}

type PythonFullCharacter = Awaited<ReturnType<typeof getPythonCharacter>>;

function avatarUrlFromPython(full: PythonFullCharacter) {
  return full.avatar
    ? `/api/roleplay/files/avatars/${full.avatar.split("/").pop()}`
    : null;
}

function characterPayloadFromPython(
  userId: number,
  full: PythonFullCharacter,
  pythonId: string
) {
  return {
    userId,
    name: full.name,
    description: full.description ?? full.personality ?? "",
    worldview: full.scenario ?? "",
    openingLine: full.first_mes ?? "",
    systemPrompt: full.system_prompt ?? null,
    isPublic: 0,
    averageRating: 0,
    usageCount: 0,
    pythonId,
    avatarUrl: avatarUrlFromPython(full),
  };
}

async function persistCharacterRecord(
  payload: Parameters<typeof memoryStore.createCharacter>[0]
) {
  if (process.env.DATABASE_URL) {
    const { id } = await db.createCharacter(payload);
    return { id, ...payload };
  }
  return memoryStore.createCharacter(payload);
}

export const charactersRouter = router({
  getMyCharacters: protectedProcedure.query(async ({ ctx }) => {
    if (process.env.DATABASE_URL) {
      try {
        await syncFromPython(ctx.user!.id);
      } catch {
        /* Python offline */
      }
      return db.getUserCharacters(ctx.user!.id);
    }
    try {
      const synced = await syncFromPython(ctx.user!.id);
      const owned = memoryStore
        .listCharacters()
        .filter((c) => c.userId === ctx.user!.id && !c.pythonId);
      const byId = new Map<number, (typeof synced)[number]>();
      [...synced, ...owned].forEach((c) => byId.set(c.id, c));
      return [...byId.values()];
    } catch {
      return memoryStore.listCharacters().filter((c) => c.userId === ctx.user!.id);
    }
  }),

  getPublic: publicProcedure.query(async () => {
    if (process.env.DATABASE_URL) {
      try {
        await syncFromPython(0);
      } catch {
        /* Python offline */
      }
      return db.getPublicCharacters();
    }
    try {
      await syncFromPython(0);
    } catch {
      /* Python offline */
    }
    return memoryStore.listCharacters().filter((c) => c.isPublic === 1);
  }),

  getLatest: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(8) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 8;
      if (process.env.DATABASE_URL) {
        try {
          await syncFromPython(0);
        } catch {
          /* Python offline */
        }
        return db.getLatestCharacters(limit);
      }
      try {
        await syncFromPython(0);
      } catch {
        /* ignore */
      }
      return memoryStore.listCharacters().slice(0, limit);
    }),

  getTemplates: publicProcedure.query(() => DEFAULT_CHARACTER_TEMPLATES),

  createFromTemplate: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const template = DEFAULT_CHARACTER_TEMPLATES.find((t) => t.id === input.templateId);
      if (!template) throw new Error("Template not found");

      const pythonId = await pushToPython({
        name: template.name,
        description: template.description,
        worldview: template.worldview,
        openingLine: template.openingLine,
        systemPrompt: template.systemPrompt,
      });

      return persistCharacterRecord({
        userId: ctx.user!.id,
        name: template.name,
        description: template.description,
        worldview: template.worldview,
        openingLine: template.openingLine,
        systemPrompt: template.systemPrompt,
        isPublic: 0,
        averageRating: 0,
        usageCount: 0,
        pythonId,
      });
    }),

  importCard: protectedProcedure
    .input(z.object({ card: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const imported = await importPythonCharacter(input.card);
      const full = await getPythonCharacter(imported.id);
      return persistCharacterRecord(
        characterPayloadFromPython(ctx.user!.id, full, imported.id)
      );
    }),

  importFromPython: protectedProcedure
    .input(z.object({ pythonId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        const existing = await db.getCharacterByPythonId(input.pythonId, ctx.user!.id);
        if (existing) return existing;
      } else {
        const existing = memoryStore
          .listCharacters()
          .find((c) => c.pythonId === input.pythonId && c.userId === ctx.user!.id);
        if (existing) return existing;
      }

      const full = await getPythonCharacter(input.pythonId);
      return persistCharacterRecord(
        characterPayloadFromPython(ctx.user!.id, full, input.pythonId)
      );
    }),

  uploadCard: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        dataBase64: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.dataBase64, "base64");
      const uploaded = await uploadPythonCharacter(buffer, input.filename);
      const full = await getPythonCharacter(uploaded.id);
      return persistCharacterRecord(
        characterPayloadFromPython(ctx.user!.id, full, uploaded.id)
      );
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        worldview: z.string(),
        openingLine: z.string(),
        systemPrompt: z.string().optional(),
        isPublic: z.number().default(0),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pythonId = await pushToPython({
        name: input.name,
        description: input.description,
        worldview: input.worldview,
        openingLine: input.openingLine,
        systemPrompt: input.systemPrompt ?? null,
      });

      if (process.env.DATABASE_URL) {
        const created = await db.createCharacter({
          userId: ctx.user!.id,
          ...input,
          pythonId,
        });
        return { ...created, pythonId };
      }

      return memoryStore.createCharacter({
        userId: ctx.user!.id,
        systemPrompt: input.systemPrompt ?? null,
        averageRating: 0,
        usageCount: 0,
        pythonId,
        ...input,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        worldview: z.string().optional(),
        openingLine: z.string().optional(),
        systemPrompt: z.string().optional(),
        isPublic: z.number().optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = process.env.DATABASE_URL
        ? await db.getCharacterById(input.id, ctx.user!.id)
        : memoryStore.getCharacter(input.id);
      const merged = {
        name: input.name ?? existing?.name ?? "Character",
        description: input.description ?? existing?.description ?? "",
        worldview: input.worldview ?? existing?.worldview ?? "",
        openingLine: input.openingLine ?? existing?.openingLine ?? "",
        systemPrompt: input.systemPrompt ?? existing?.systemPrompt ?? null,
        id: existing?.pythonId,
      };

      const pythonId = await pushToPython(merged);

      if (process.env.DATABASE_URL) {
        const { id, ...data } = input;
        await db.updateCharacter(id, ctx.user!.id, { ...data, pythonId });
        return { success: true, pythonId };
      }

      const updated = memoryStore.updateCharacter(input.id, { ...input, pythonId });
      if (!updated) throw new Error("Character not found");
      return { success: true, pythonId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = process.env.DATABASE_URL
        ? await db.getCharacterById(input.id, ctx.user!.id)
        : memoryStore.getCharacter(input.id);
      if (existing?.pythonId) {
        try {
          await deletePythonCharacter(existing.pythonId);
        } catch {
          /* Python offline or already removed */
        }
      }

      if (process.env.DATABASE_URL) {
        await db.deleteCharacter(input.id, ctx.user!.id);
        return { success: true };
      }
      memoryStore.deleteCharacter(input.id);
      return { success: true };
    }),

  clone: protectedProcedure
    .input(
      z.object({
        characterId: z.number().optional(),
        sourceCharacterId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const characterId = input.characterId ?? input.sourceCharacterId;
      if (!characterId) throw new Error("characterId is required");
      if (process.env.DATABASE_URL) {
        const source = await db.getCharacterByIdAny(characterId);
        if (!source) throw new Error("Character not found");

        const pythonId = await pushToPython({
          name: `${source.name} (copy)`,
          description: source.description,
          worldview: source.worldview,
          openingLine: source.openingLine,
          systemPrompt: source.systemPrompt,
        });

        const cloned = await db.cloneCharacter(characterId, ctx.user!.id);
        await db.updateCharacter(cloned.id, ctx.user!.id, { pythonId });
        return { success: true, id: cloned.id };
      }
      const source = memoryStore.getCharacter(characterId);
      if (!source) throw new Error("Character not found");

      const pythonId = await pushToPython({
        name: `${source.name} (copy)`,
        description: source.description,
        worldview: source.worldview,
        openingLine: source.openingLine,
        systemPrompt: source.systemPrompt,
      });

      const copy = memoryStore.createCharacter({
        ...source,
        userId: ctx.user!.id,
        name: `${source.name} (copy)`,
        isPublic: 0,
        pythonId,
      });
      return { success: true, id: copy.id };
    }),

  generatePortrait: protectedProcedure
    .input(
      z.object({
        characterId: z.number(),
        description: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const character = process.env.DATABASE_URL
        ? await db.getCharacterById(input.characterId, ctx.user!.id)
        : memoryStore.getCharacter(input.characterId);
      if (!character?.pythonId) {
        throw new Error("Character must be saved and synced to Python first");
      }

      const promptDesc =
        input.description ??
        `${character.name}. ${character.description}. ${character.worldview}`;

      const result = await generatePythonPortrait(character.pythonId, {
        description: promptDesc,
        width: input.width ?? 512,
        height: input.height ?? 768,
      });

      const imageUrl =
        result.url ??
        (result.path
          ? `/api/generate/files/images/${result.path.split(/[/\\]/).pop()}`
          : "");

      if (!imageUrl) throw new Error("Portrait generation returned no image");

      let updated = null;
      if (process.env.DATABASE_URL) {
        await db.updateCharacter(input.characterId, ctx.user!.id, { avatarUrl: imageUrl });
        updated = await db.getCharacterById(input.characterId, ctx.user!.id);
      } else {
        updated = memoryStore.updateCharacter(input.characterId, {
          avatarUrl: imageUrl,
        });
      }

      return {
        success: true,
        imageUrl,
        character: updated,
        warning: result.warning,
      };
    }),

  rateCharacter: protectedProcedure
    .input(
      z.object({
        characterId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        await db.addCharacterRating(
          input.characterId,
          ctx.user!.id,
          input.rating,
          input.comment
        );
        const ratings = await db.getCharacterRatings(input.characterId);
        const average =
          ratings.length > 0
            ? Math.round(
                (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10
              ) / 10
            : 0;
        await db.updateCharacterAverageRating(input.characterId, average);
        return { success: true, averageRating: average };
      }

      const character = memoryStore.getCharacter(input.characterId);
      if (!character) throw new Error("Character not found");
      const nextRating = Math.round(
        ((character.averageRating || 0) + input.rating) / 2
      );
      memoryStore.updateCharacter(input.characterId, { averageRating: nextRating });
      return { success: true, averageRating: nextRating };
    }),

  getCharacterRatings: publicProcedure
    .input(z.object({ characterId: z.number() }))
    .query(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        return db.getCharacterRatings(input.characterId);
      }
      return [];
    }),

  getMyAnalytics: protectedProcedure.query(async ({ ctx }) => {
    if (process.env.DATABASE_URL) {
      return db.getMyAnalyticsForUser(ctx.user!.id);
    }
    const chars = memoryStore.listCharacters().filter((c) => c.userId === ctx.user!.id);
    const convs = memoryStore.listConversations(ctx.user!.id);
    return chars.map((c) => ({
      characterId: c.id,
      characterName: c.name,
      conversationCount: convs.filter((cv) => cv.characterId === c.id).length,
      messageCount: c.usageCount,
      averageRating: c.averageRating,
      usageCount: c.usageCount,
    }));
  }),
});