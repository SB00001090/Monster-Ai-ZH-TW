/**
 * Self-Awareness Engine for MonsterAi
 * Implements AI self-reflection, self-evaluation, and continuous improvement
 */

import { invokeLLM } from "./llm";
import * as db from "../db";

export interface SelfReflectionResult {
  responseQuality: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  confidenceScore: number; // 0-1
  reflectionTimestamp: Date;
}

export interface SelfEvaluationMetrics {
  averageResponseQuality: number;
  consistencyScore: number;
  improvementTrend: "improving" | "stable" | "declining";
  totalEvaluations: number;
  lastEvaluationDate: Date | null;
}

/**
 * Performs self-reflection on AI responses
 * Analyzes response quality, relevance, and helpfulness
 */
export async function performSelfReflection(
  userId: number,
  messageId: number,
  userMessage: string,
  aiResponse: string,
  userFeedback?: { rating: number; comment?: string }
): Promise<SelfReflectionResult> {
  try {
    console.log("[SelfAwareness] Starting self-reflection for message:", messageId);

    // Get LLM to evaluate its own response
    const reflectionPrompt = `You are an AI assistant evaluating your own response quality. 
    
User's question: "${userMessage}"
Your response: "${aiResponse}"
${userFeedback ? `User's feedback: Rating ${userFeedback.rating}/5${userFeedback.comment ? `, Comment: ${userFeedback.comment}` : ""}` : ""}

Evaluate your response on:
1. Accuracy and correctness
2. Relevance to the question
3. Clarity and helpfulness
4. Completeness
5. Tone appropriateness

Provide a JSON response with:
{
  "quality_score": <0-100>,
  "strengths": [<list of strengths>],
  "weaknesses": [<list of weaknesses>],
  "improvement_suggestions": [<list of suggestions>],
  "confidence": <0-1>,
  "reasoning": "<brief explanation>"
}`;

    const reflectionResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a critical evaluator of AI responses. Provide honest, constructive feedback.",
        },
        {
          role: "user",
          content: reflectionPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "self_reflection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              quality_score: { type: "number", minimum: 0, maximum: 100 },
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              improvement_suggestions: { type: "array", items: { type: "string" } },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reasoning: { type: "string" },
            },
            required: [
              "quality_score",
              "strengths",
              "weaknesses",
              "improvement_suggestions",
              "confidence",
              "reasoning",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    let evaluationData;
    try {
      const content = reflectionResponse.choices[0]?.message?.content;
      evaluationData = typeof content === "string" ? JSON.parse(content) : content;
    } catch (parseError) {
      console.error("[SelfAwareness] Failed to parse reflection response:", parseError);
      evaluationData = {
        quality_score: 50,
        strengths: ["Response provided"],
        weaknesses: ["Unable to self-evaluate"],
        improvement_suggestions: ["Continue learning"],
        confidence: 0.3,
      };
    }

    const result: SelfReflectionResult = {
      responseQuality: evaluationData.quality_score || 50,
      strengths: evaluationData.strengths || [],
      weaknesses: evaluationData.weaknesses || [],
      suggestions: evaluationData.improvement_suggestions || [],
      confidenceScore: evaluationData.confidence || 0.5,
      reflectionTimestamp: new Date(),
    };

    // Save reflection to database
    await saveReflectionLog(userId, messageId, result);

    console.log("[SelfAwareness] Self-reflection completed. Quality score:", result.responseQuality);
    return result;
  } catch (error) {
    console.error("[SelfAwareness] Error during self-reflection:", error);
    throw error;
  }
}

/**
 * Analyzes patterns in feedback and generates improvement strategies
 */
export async function analyzePerformancePatterns(userId: number): Promise<{
  patterns: string[];
  strategies: string[];
  priorityAreas: string[];
}> {
  try {
    console.log("[SelfAwareness] Analyzing performance patterns for user:", userId);

    const userFeedback = await db.getUserFeedback(userId);
    const improvements = await db.getUserModelImprovements(userId);
    const optimizations = await db.getUserPromptOptimizations(userId);

    if (userFeedback.length === 0) {
      return {
        patterns: ["Insufficient data for analysis"],
        strategies: ["Continue gathering feedback"],
        priorityAreas: [],
      };
    }

    // Calculate metrics
    const avgRating =
      userFeedback.reduce((sum, f) => sum + f.rating, 0) / userFeedback.length;
    const lowRatedCount = userFeedback.filter((f) => f.rating <= 2).length;
    const highRatedCount = userFeedback.filter((f) => f.rating >= 4).length;

    // Extract common tags from low-rated feedback
    const lowRatedFeedback = userFeedback.filter((f) => f.rating <= 2);
    const commonIssues = lowRatedFeedback
      .flatMap((f) => f.tags?.split(",") || [])
      .reduce((acc: Record<string, number>, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

    // Use LLM to generate insights
    const analysisPrompt = `Analyze these AI performance metrics and suggest improvements:

Average user rating: ${avgRating.toFixed(2)}/5
Total feedback entries: ${userFeedback.length}
High-rated responses (4-5): ${highRatedCount}
Low-rated responses (1-2): ${lowRatedCount}
Common issues in low-rated responses: ${Object.entries(commonIssues)
      .map(([issue, count]) => `${issue} (${count} times)`)
      .join(", ")}
Previous improvements attempted: ${improvements.length}
Prompt optimizations applied: ${optimizations.length}

Provide a JSON response with:
{
  "identified_patterns": [<list of patterns>],
  "improvement_strategies": [<list of strategies>],
  "priority_improvement_areas": [<list of priority areas>],
  "confidence_level": <0-1>
}`;

    const analysisResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an AI performance analyst. Provide data-driven insights for improvement.",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "performance_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              identified_patterns: { type: "array", items: { type: "string" } },
              improvement_strategies: { type: "array", items: { type: "string" } },
              priority_improvement_areas: { type: "array", items: { type: "string" } },
              confidence_level: { type: "number", minimum: 0, maximum: 1 },
            },
            required: [
              "identified_patterns",
              "improvement_strategies",
              "priority_improvement_areas",
              "confidence_level",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    let analysisData;
    try {
      const content = analysisResponse.choices[0]?.message?.content;
      analysisData = typeof content === "string" ? JSON.parse(content) : content;
    } catch (parseError) {
      console.error("[SelfAwareness] Failed to parse analysis response:", parseError);
      analysisData = {
        identified_patterns: ["Insufficient data"],
        improvement_strategies: ["Gather more feedback"],
        priority_improvement_areas: [],
        confidence_level: 0.3,
      };
    }

    return {
      patterns: analysisData.identified_patterns || [],
      strategies: analysisData.improvement_strategies || [],
      priorityAreas: analysisData.priority_improvement_areas || [],
    };
  } catch (error) {
    console.error("[SelfAwareness] Error analyzing performance patterns:", error);
    throw error;
  }
}

/**
 * Generates self-improvement recommendations based on feedback
 */
export async function generateImprovementRecommendations(
  userId: number
): Promise<string[]> {
  try {
    console.log("[SelfAwareness] Generating improvement recommendations for user:", userId);

    const analysis = await analyzePerformancePatterns(userId);

    // Use LLM to generate specific, actionable recommendations
    const recommendationPrompt = `Based on these performance analysis results, generate specific, actionable recommendations for AI improvement:

Identified patterns: ${analysis.patterns.join(", ")}
Current strategies: ${analysis.strategies.join(", ")}
Priority areas: ${analysis.priorityAreas.join(", ")}

Provide a JSON response with:
{
  "recommendations": [<list of specific, actionable recommendations>],
  "implementation_priority": [<ordered by priority>]
}`;

    const recResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an AI improvement specialist. Provide specific, actionable recommendations.",
        },
        {
          role: "user",
          content: recommendationPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: { type: "array", items: { type: "string" } },
              implementation_priority: { type: "array", items: { type: "string" } },
            },
            required: ["recommendations", "implementation_priority"],
            additionalProperties: false,
          },
        },
      },
    });

    let recData;
    try {
      const content = recResponse.choices[0]?.message?.content;
      recData = typeof content === "string" ? JSON.parse(content) : content;
    } catch (parseError) {
      console.error("[SelfAwareness] Failed to parse recommendations:", parseError);
      recData = {
        recommendations: ["Continue learning from user feedback"],
        implementation_priority: [],
      };
    }

    return recData.recommendations || [];
  } catch (error) {
    console.error("[SelfAwareness] Error generating recommendations:", error);
    throw error;
  }
}

/**
 * Calculates self-evaluation metrics
 */
export async function calculateSelfEvaluationMetrics(
  userId: number
): Promise<SelfEvaluationMetrics> {
  try {
    const allFeedback = await db.getUserFeedback(userId);
    const avgRating = await db.getAverageRatingForUser(userId);

    if (allFeedback.length === 0) {
      return {
        averageResponseQuality: 0,
        consistencyScore: 0,
        improvementTrend: "stable",
        totalEvaluations: 0,
        lastEvaluationDate: null,
      };
    }

    // Calculate consistency (low variance = high consistency)
    const ratings = allFeedback.map((f) => f.rating);
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const variance =
      ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratings.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - stdDev * 20); // Normalize to 0-100

    // Determine trend (compare recent vs older feedback)
    const recentFeedback = allFeedback.slice(0, Math.ceil(allFeedback.length / 3));
    const olderFeedback = allFeedback.slice(Math.ceil(allFeedback.length / 3));

    const recentAvg =
      recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length;
    const olderAvg =
      olderFeedback.length > 0
        ? olderFeedback.reduce((sum, f) => sum + f.rating, 0) / olderFeedback.length
        : recentAvg;

    let improvementTrend: "improving" | "stable" | "declining" = "stable";
    if (recentAvg > olderAvg + 0.5) {
      improvementTrend = "improving";
    } else if (recentAvg < olderAvg - 0.5) {
      improvementTrend = "declining";
    }

    return {
      averageResponseQuality: avgRating || 0,
      consistencyScore: Math.round(consistencyScore),
      improvementTrend,
      totalEvaluations: allFeedback.length,
      lastEvaluationDate: allFeedback[0]?.createdAt || null,
    };
  } catch (error) {
    console.error("[SelfAwareness] Error calculating metrics:", error);
    throw error;
  }
}

/**
 * Helper function to save reflection logs
 */
async function saveReflectionLog(
  userId: number,
  messageId: number,
  reflection: SelfReflectionResult
): Promise<void> {
  try {
    // Save as model improvement record
    await db.saveModelImprovement({
      userId,
      improvementType: "self_reflection",
      description: `Self-reflection on message ${messageId}. Quality: ${reflection.responseQuality}/100. Weaknesses: ${reflection.weaknesses.join(", ")}`,
      feedbackCount: 1,
      averageRating: Math.round(reflection.responseQuality * 10),
    });
  } catch (error) {
    console.error("[SelfAwareness] Error saving reflection log:", error);
  }
}

/**
 * Performs continuous self-improvement cycle
 */
export async function runSelfImprovementCycle(userId: number): Promise<{
  cycleId: string;
  timestamp: Date;
  analysis: Awaited<ReturnType<typeof analyzePerformancePatterns>>;
  recommendations: string[];
  metrics: SelfEvaluationMetrics;
}> {
  try {
    console.log("[SelfAwareness] Running self-improvement cycle for user:", userId);

    const cycleId = `cycle-${Date.now()}`;
    const timestamp = new Date();

    // Analyze performance
    const analysis = await analyzePerformancePatterns(userId);

    // Generate recommendations
    const recommendations = await generateImprovementRecommendations(userId);

    // Calculate metrics
    const metrics = await calculateSelfEvaluationMetrics(userId);

    console.log("[SelfAwareness] Self-improvement cycle completed:", cycleId);

    return {
      cycleId,
      timestamp,
      analysis,
      recommendations,
      metrics,
    };
  } catch (error) {
    console.error("[SelfAwareness] Error running self-improvement cycle:", error);
    throw error;
  }
}
