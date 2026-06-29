import { z } from "zod";
import { notifyOwner } from "./notification";
import { pythonHealth } from "./pythonBridge";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => {
      let python: { ok: boolean; backend?: string } = { ok: false };
      try {
        const status = await pythonHealth();
        python = { ok: status.status === "ok", backend: status.llm_backend };
      } catch {
        python = { ok: false };
      }
      return { ok: true, python };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
