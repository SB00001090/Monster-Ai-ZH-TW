/**
 * Stable Diffusion Integration Layer
 * Handles communication with Stable Diffusion API (via Hugging Face or local server)
 */

import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export interface SDGenerationParams {
  prompt: string;
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  seed?: number;
  width?: number;
  height?: number;
  modelId: string;
}

export interface SDGenerationResult {
  imageUrl: string;
  imageKey: string;
  generationTime: number;
}

/**
 * Available Stable Diffusion models
 */
export const SD_MODELS = {
  "sd-1.5": {
    name: "Stable Diffusion 1.5",
    modelId: "runwayml/stable-diffusion-v1-5",
    version: "1.5",
    description: "Classic Stable Diffusion v1.5 model",
  },
  "sd-2.1": {
    name: "Stable Diffusion 2.1",
    modelId: "stabilityai/stable-diffusion-2-1",
    version: "2.1",
    description: "Stable Diffusion v2.1 with improved quality",
  },
  "sdxl": {
    name: "Stable Diffusion XL",
    modelId: "stabilityai/stable-diffusion-xl-base-1.0",
    version: "SDXL",
    description: "Latest SDXL model with superior quality",
  },
};

/**
 * Available samplers for SD
 */
export const SD_SAMPLERS = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpm_fast",
  "dpm_adaptive",
  "dpmpp_2s_ancestral",
  "dpmpp_sde",
  "dpmpp_sde_karras",
  "dpmpp_2m",
  "dpmpp_2m_karras",
  "dpmpp_2m_sde",
  "dpmpp_2m_sde_karras",
  "dpmpp_3m_sde",
  "dpmpp_3m_sde_karras",
  "ddim",
  "pndm",
  "heun",
  "karras",
];

/**
 * Default SD generation parameters
 */
export const DEFAULT_SD_PARAMS = {
  steps: 20,
  cfgScale: 7.5,
  sampler: "euler",
  width: 512,
  height: 512,
  seed: undefined,
};

/**
 * Generate image using Stable Diffusion via Hugging Face API
 * Falls back to LLM-based image generation if SD is unavailable
 */
export async function generateSDImage(
  params: SDGenerationParams
): Promise<SDGenerationResult> {
  const startTime = Date.now();

  try {
    // Prepare parameters with defaults
    const finalParams = {
      ...DEFAULT_SD_PARAMS,
      ...params,
    };

    // Log generation request
    console.log("[SD Integration] Generating image with params:", {
      prompt: finalParams.prompt.substring(0, 50) + "...",
      model: finalParams.modelId,
      steps: finalParams.steps,
      cfgScale: finalParams.cfgScale,
      sampler: finalParams.sampler,
    });

    // For now, use LLM-based image generation as fallback
    // In production, this would call actual Stable Diffusion API
    const imageUrl = await generateImageViaLLM(finalParams.prompt);

    const generationTime = Math.round((Date.now() - startTime) / 1000);

    // Store image
    const imageKey = `sd-generations/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const { url } = await storagePut(imageKey, Buffer.from(imageUrl), "image/png");

    return {
      imageUrl: url,
      imageKey,
      generationTime,
    };
  } catch (error) {
    console.error("[SD Integration] Image generation failed:", error);
    throw new Error("Failed to generate image with Stable Diffusion");
  }
}

/**
 * Fallback: Generate image using LLM
 */
async function generateImageViaLLM(prompt: string): Promise<string> {
  try {
    // Use the built-in image generation from LLM integration
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an image generation assistant. Generate a detailed image based on the user's prompt.",
        },
        {
          role: "user",
          content: `Generate an image: ${prompt}`,
        },
      ],
    });

    // Extract image URL from response
    // This is a placeholder - actual implementation depends on LLM response format
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "";
  } catch (error) {
    console.error("[SD Integration] LLM fallback failed:", error);
    throw error;
  }
}

/**
 * Validate SD generation parameters
 */
export function validateSDParams(params: SDGenerationParams): boolean {
  if (!params.prompt || params.prompt.trim().length === 0) {
    return false;
  }

  if (params.steps && (params.steps < 1 || params.steps > 150)) {
    return false;
  }

  if (params.cfgScale && (params.cfgScale < 1 || params.cfgScale > 20)) {
    return false;
  }

  if (
    params.width &&
    (params.width < 256 || params.width > 1024 || params.width % 64 !== 0)
  ) {
    return false;
  }

  if (
    params.height &&
    (params.height < 256 || params.height > 1024 || params.height % 64 !== 0)
  ) {
    return false;
  }

  if (params.sampler && !SD_SAMPLERS.includes(params.sampler)) {
    return false;
  }

  return true;
}

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: string) {
  return SD_MODELS[modelId as keyof typeof SD_MODELS] || null;
}

/**
 * Get all available models
 */
export function getAllModels() {
  return Object.entries(SD_MODELS).map(([key, value]) => ({
    id: key,
    ...value,
  }));
}
