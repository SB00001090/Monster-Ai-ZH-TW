import { z } from "zod";
import * as db from "../db";
import { memoryStore } from "../_core/memoryStore";
import { pythonHealth, pythonStatus } from "../_core/pythonBridge";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const llmRouter = router({
  getBackendStatus: publicProcedure.query(async () => {
    try {
      const [health, status] = await Promise.all([pythonHealth(), pythonStatus()]);
      return {
        ok: health.status === "ok",
        backend: health.llm_backend ?? null,
        ...status,
      };
    } catch {
      return { ok: false, backend: null };
    }
  }),

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    if (process.env.DATABASE_URL) {
      return db.getUserLLMConfig(ctx.user!.id);
    }
    return memoryStore.getLLMConfig(ctx.user!.id);
  }),

  updateConfig: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      if (process.env.DATABASE_URL) {
        return db.updateUserLLMConfig(ctx.user!.id, input);
      }
      memoryStore.setLLMConfig(ctx.user!.id, input);
      return input;
    }),

  deleteConfig: protectedProcedure.mutation(async ({ ctx }) => {
    if (process.env.DATABASE_URL) {
      await db.deleteUserLLMConfig(ctx.user!.id);
    } else {
      memoryStore.deleteLLMConfig(ctx.user!.id);
    }
    return { success: true };
  }),
});