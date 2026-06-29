// Unfiltered image generation route (developer only)
export const unfilteredImageRoute = `
    generateUnfilteredBatchImages: developerProcedure
      .input(z.object({
        conversationId: z.number(),
        prompt: z.string().min(1),
        negativePrompt: z.string().optional(),
        steps: z.number().min(1).max(150).default(20),
        cfgScale: z.number().min(1).max(20).default(7),
        sampler: z.string().default("euler"),
        width: z.number().default(512),
        height: z.number().default(512),
        seed: z.number().optional(),
        batchSize: z.number().min(1).max(10).default(5),
        loraModels: z.array(z.object({ name: z.string(), weight: z.number() })).optional(),
        vaeModel: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const params: ComfyUIGenerationParams = {
            prompt: input.prompt,
            negativePrompt: input.negativePrompt,
            steps: input.steps,
            cfgScale: input.cfgScale,
            sampler: input.sampler,
            width: input.width,
            height: input.height,
            seed: input.seed,
            batchSize: input.batchSize,
            loraModels: input.loraModels,
            vaeModel: input.vaeModel,
          };

          const result = await executeComfyUIWorkflow(params);

          const savedImages = [];
          for (const image of result.images) {
            const imageKey = \`unfiltered-generations/\${Date.now()}-\${Math.random().toString(36).substring(7)}.png\`;
            await db.saveGeneratedImage(
              input.conversationId,
              ctx.user!.id,
              \`[UNFILTERED] \${input.prompt}\`,
              image.url,
              imageKey
            );
            savedImages.push({
              url: image.url,
              seed: image.seed,
              generationTime: image.generationTime,
            });
          }

          console.log(\`[AUDIT] Developer \${ctx.user!.id} generated \${savedImages.length} unfiltered images\`);

          return {
            success: true,
            images: savedImages,
            totalTime: result.totalTime,
            isUnfiltered: true,
          };
        } catch (error) {
          console.error('Unfiltered batch image generation error:', error);
          throw new Error('Failed to generate unfiltered batch images');
        }
      }),
`;
