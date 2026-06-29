/**
 * Automatic SD Image Generation Integration
 * Automatically triggers Stable Diffusion image generation when user provides prompts with weights
 */

import { getSDGenerationInfo, shouldAutoGenerateSD } from "./promptAnalyzer";
import { generateSDImage } from "./sdIntegration";
import { getDb } from "./db";
import { generatedImages } from "../drizzle/schema";

export interface AutoGenerationResult {
  triggered: boolean;
  imageUrl?: string;
  imageKey?: string;
  prompt?: string;
  error?: string;
}

/**
 * Check if a message should trigger automatic SD generation and process it
 */
export async function processAutoSDGeneration(
  userMessage: string,
  conversationId: number,
  userId: number
): Promise<AutoGenerationResult> {
  // Check if message contains SD prompt
  if (!shouldAutoGenerateSD(userMessage)) {
    return { triggered: false };
  }

  try {
    const generationInfo = getSDGenerationInfo(userMessage);
    if (!generationInfo) {
      return { triggered: false };
    }

    // Generate image using SD
    const result = await generateSDImage({
      prompt: generationInfo.formattedPrompt,
      negativePrompt: generationInfo.params.negativePrompt,
      steps: generationInfo.params.steps || 25,
      cfgScale: generationInfo.params.cfgScale || 7.5,
      sampler: generationInfo.params.sampler,
      seed: generationInfo.params.seed,
      modelId: "stabilityai/stable-diffusion-xl-base-1.0", // Default to SDXL
    });

    // Save generated image to database
    const db = await getDb();
    if (db && result.imageUrl) {
      try {
        await db.insert(generatedImages).values({
          conversationId,
          userId,
          prompt: generationInfo.formattedPrompt,
          imageUrl: result.imageUrl,
          imageKey: result.imageKey,
          createdAt: new Date(),
        });
      } catch (dbError) {
        console.error("Failed to save generated image to database:", dbError);
        // Continue even if DB save fails - image is still generated
      }
    }

    return {
      triggered: true,
      imageUrl: result.imageUrl,
      imageKey: result.imageKey,
      prompt: generationInfo.formattedPrompt,
    };
  } catch (error) {
    console.error("Auto SD generation failed:", error);
    return {
      triggered: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format auto-generation result as AI response message
 */
export function formatAutoGenerationResponse(result: AutoGenerationResult): string {
  if (!result.triggered) {
    return "";
  }

  if (result.error) {
    return `❌ Image generation failed: ${result.error}`;
  }

  if (result.imageUrl) {
    return `✨ Generated image from your prompt:\n\n**Prompt:** ${result.prompt}\n\n![Generated Image](${result.imageUrl})`;
  }

  return "🎨 Processing your image generation request...";
}

/**
 * Check batch of messages for auto-generation opportunities
 */
export async function processBatchAutoGeneration(
  messages: Array<{ content: string; conversationId: number; userId: number }>
): Promise<AutoGenerationResult[]> {
  return Promise.all(
    messages.map((msg) =>
      processAutoSDGeneration(msg.content, msg.conversationId, msg.userId)
    )
  );
}

/**
 * Get AI response message for auto-generated image
 */
export function getAutoGenerationAIResponse(result: AutoGenerationResult): string {
  if (!result.triggered) {
    return "";
  }

  if (result.error) {
    return `I attempted to generate an image from your prompt, but encountered an error: ${result.error}. Please try again or adjust your prompt.`;
  }

  if (result.imageUrl) {
    return `I've generated an image based on your prompt. Here's the result with your specified weights and parameters applied.`;
  }

  return "I'm processing your image generation request. Please wait...";
}
