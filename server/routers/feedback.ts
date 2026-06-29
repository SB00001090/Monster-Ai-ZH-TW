import { z } from "zod";
import * as db from "../db";
import * as selfAwareness from "../_core/selfAwareness";
import { protectedProcedure, router } from "../_core/trpc";

function sentimentFromRating(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

export const feedbackRouter = router({
  submitFeedback: protectedProcedure
    .input(
      z.object({
        messageId: z.number().optional(),
        rating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.saveFeedback({
        messageId: input.messageId ?? 0,
        userId: ctx.user!.id,
        rating: input.rating ?? 3,
        comment: input.comment,
        tags: input.tags,
        sentiment: sentimentFromRating(input.rating ?? 3),
      });
      return { success: true };
    }),

  getUserStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;
    const allFeedback = await db.getUserFeedback(userId);
    const averageRating = await db.getAverageRatingForUser(userId);

    if (process.env.DATABASE_URL) {
      const improvements = await db.getUserModelImprovements(userId);
      const optimizations = await db.getUserPromptOptimizations(userId);
      return {
        totalFeedback: allFeedback.length,
        averageRating,
        improvements: improvements.length,
        optimizations: optimizations.length,
      };
    }

    return {
      totalFeedback: allFeedback.length,
      averageRating,
      improvements: 0,
      optimizations: 0,
    };
  }),

  getSelfEvaluationMetrics: protectedProcedure.query(async ({ ctx }) => {
    const metrics = await selfAwareness.calculateSelfEvaluationMetrics(ctx.user!.id);
    return {
      overallScore: metrics.averageResponseQuality,
      responseQuality: metrics.averageResponseQuality,
      averageResponseQuality: metrics.averageResponseQuality,
      userSatisfaction: metrics.averageResponseQuality,
      consistencyScore: metrics.consistencyScore,
      totalEvaluations: metrics.totalEvaluations,
      improvementTrend: metrics.improvementTrend,
    };
  }),

  getPerformanceAnalysis: protectedProcedure.query(async ({ ctx }) => {
    const analysis = await selfAwareness.analyzePerformancePatterns(ctx.user!.id);
    return {
      strengths: [] as string[],
      weaknesses: [] as string[],
      patterns: analysis.patterns,
      strategies: analysis.strategies,
      priorityAreas: analysis.priorityAreas,
    };
  }),

  getImprovementRecommendations: protectedProcedure.query(async ({ ctx }) => {
    return selfAwareness.generateImprovementRecommendations(ctx.user!.id);
  }),

  runSelfImprovementCycle: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await selfAwareness.runSelfImprovementCycle(ctx.user!.id);
    return {
      success: true,
      message: "Self-improvement cycle completed",
      cycleId: result.cycleId,
    };
  }),
});