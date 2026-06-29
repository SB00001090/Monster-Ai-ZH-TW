import { z } from "zod";
import * as db from "../db";
import { memoryStore } from "../_core/memoryStore";
import {
  generatePythonImage,
  generatePythonVideo,
  listPythonCheckpoints,
} from "../_core/pythonBridge";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

function resolveImageUrl(url: string | undefined, path: string | undefined) {
  if (url) return url.startsWith("http") ? url : url;
  if (path) {
    const name = path.split(/[/\\]/).pop();
    return name ? `/api/generate/files/images/${name}` : "";
  }
  return "";
}

export const imageRouter = router({
  getCheckpoints: publicProcedure.query(async () => {
    try {
      return await listPythonCheckpoints();
    } catch {
      return { checkpoints: [], active: null };
    }
  }),

  getGallery: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ input }) => {
      if (process.env.DATABASE_URL) {
        return db.getConversationImages(input.conversationId);
      }
      return memoryStore.listImages(input.conversationId);
    }),

  generateImage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().optional(),
        prompt: z.string().min(1),
        negativePrompt: z.string().optional(),
        steps: z.number().optional(),
        cfgScale: z.number().optional(),
        sampler: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        seed: z.number().optional(),
        style: z.string().optional(),
        checkpoint: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await generatePythonImage({
        prompt: input.prompt,
        negative: input.negativePrompt,
        width: input.width,
        height: input.height,
        style: input.style,
        checkpoint: input.checkpoint,
      });

      const imageUrl = resolveImageUrl(result.url, result.path);
      const imageKey = imageUrl.split("/").pop() ?? `generated/${Date.now()}.png`;

      if (input.conversationId) {
        if (process.env.DATABASE_URL) {
          await db.saveGeneratedImage(
            input.conversationId,
            ctx.user!.id,
            input.prompt,
            imageUrl,
            imageKey
          );
        } else {
          memoryStore.addImage(
            input.conversationId,
            ctx.user!.id,
            input.prompt,
            imageUrl,
            imageKey
          );
        }
      }

      return {
        success: true,
        imageUrl,
        imageKey,
        warning: result.warning,
        prompt: result.prompt,
      };
    }),

  generateVideo: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        duration: z.number().optional(),
        fps: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const fps = input.fps ?? 24;
      const duration = input.duration ?? 10;
      const frames = Math.max(8, Math.round(duration * fps));

      const result = await generatePythonVideo({
        prompt: input.prompt,
        frames,
        fps,
        width: input.width,
        height: input.height,
      });

      const videoUrl =
        result.url ??
        (result.path
          ? `/api/generate/files/videos/${result.path.split(/[/\\]/).pop()}`
          : "");

      return { success: Boolean(videoUrl), videoUrl, prompt: result.prompt };
    }),

  generateCharacterImage: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        width: z.number().optional(),
        height: z.number().optional(),
        count: z.number().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ input }) => {
      const images: string[] = [];
      let warning: string | undefined;

      for (let i = 0; i < input.count; i++) {
        const result = await generatePythonImage({
          prompt: `${input.prompt}, portrait, character design, variation ${i + 1}`,
          width: input.width ?? 512,
          height: input.height ?? 768,
        });
        const imageUrl = resolveImageUrl(result.url, result.path);
        if (imageUrl) images.push(imageUrl);
        warning = warning ?? result.warning;
      }

      return {
        success: images.length > 0,
        images,
        url: images[0] ?? null,
        warning,
      };
    }),
});