/**
 * SVD (Stable Video Diffusion) Integration Module
 * Handles image-to-video generation using Stable Video Diffusion models
 */

import { invokeLLM } from "./llm";

export interface SVDGenerationParams {
  imageUrl: string;
  modelVersion: "svd" | "svd_xt";
  numFrames?: number;
  fps?: number;
  motionBucketId?: number;
  condAugScale?: number;
  seed?: number;
  decoding_t?: number;
}

export interface SVDGenerationResult {
  videoUrl: string;
  videoKey: string;
  duration: number;
  frameCount: number;
  modelUsed: string;
  generatedAt: number;
}

/**
 * Generate video from image using SVD
 */
export async function generateVideoFromImage(
  params: SVDGenerationParams
): Promise<SVDGenerationResult> {
  try {
    // Validate parameters
    if (!params.imageUrl) {
      throw new Error("Image URL is required");
    }

    if (!["svd", "svd_xt"].includes(params.modelVersion)) {
      throw new Error("Invalid model version. Use 'svd' or 'svd_xt'");
    }

    // Set defaults
    const numFrames = params.numFrames || (params.modelVersion === "svd" ? 14 : 25);
    const fps = params.fps || 6;
    const motionBucketId = params.motionBucketId || 127;
    const condAugScale = params.condAugScale || 1.0;
    const seed = params.seed || Math.floor(Math.random() * 1000000);
    const decodingT = params.decoding_t || 1;

    // Validate frame count based on model
    if (params.modelVersion === "svd" && numFrames > 14) {
      throw new Error("SVD model supports maximum 14 frames");
    }
    if (params.modelVersion === "svd_xt" && numFrames > 25) {
      throw new Error("SVD_XT model supports maximum 25 frames");
    }

    // Call LLM for video generation (simulated)
    // In production, this would call the actual SVD API or local model
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a video generation assistant. Generate a video description based on the image and parameters.
Model: ${params.modelVersion}
Frames: ${numFrames}
FPS: ${fps}
Motion Bucket ID: ${motionBucketId}`,
        },
        {
          role: "user",
          content: `Generate a video from this image: ${params.imageUrl}`,
        },
      ],
    });

    // Calculate video duration
    const duration = numFrames / fps;

    // Return mock result (in production, would return actual video URL)
    return {
      videoUrl: `/monster-storage/video_${seed}.mp4`,
      videoKey: `videos/svd_${params.modelVersion}_${seed}`,
      duration,
      frameCount: numFrames,
      modelUsed: params.modelVersion,
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.error("SVD video generation error:", error);
    throw error;
  }
}

/**
 * Get available SVD models
 */
export function getAvailableSVDModels() {
  return [
    {
      id: "svd",
      name: "Stable Video Diffusion (14 frames)",
      maxFrames: 14,
      vramRequired: 15,
      description: "Standard SVD model for 14-frame video generation",
    },
    {
      id: "svd_xt",
      name: "Stable Video Diffusion XT (25 frames)",
      maxFrames: 25,
      vramRequired: 18,
      description: "Extended SVD model for 25-frame video generation",
    },
  ];
}

/**
 * Validate SVD generation parameters
 */
export function validateSVDParams(params: SVDGenerationParams): string[] {
  const errors: string[] = [];

  if (!params.imageUrl) {
    errors.push("Image URL is required");
  }

  if (!["svd", "svd_xt"].includes(params.modelVersion)) {
    errors.push("Invalid model version");
  }

  if (params.numFrames) {
    const maxFrames = params.modelVersion === "svd" ? 14 : 25;
    if (params.numFrames < 1 || params.numFrames > maxFrames) {
      errors.push(`Frame count must be between 1 and ${maxFrames}`);
    }
  }

  if (params.fps && (params.fps < 1 || params.fps > 30)) {
    errors.push("FPS must be between 1 and 30");
  }

  if (params.motionBucketId && (params.motionBucketId < 0 || params.motionBucketId > 255)) {
    errors.push("Motion bucket ID must be between 0 and 255");
  }

  if (params.condAugScale && (params.condAugScale < 0 || params.condAugScale > 1)) {
    errors.push("Conditioning augmentation scale must be between 0 and 1");
  }

  return errors;
}

/**
 * Get SVD model info
 */
export function getSVDModelInfo(modelVersion: "svd" | "svd_xt") {
  const models = getAvailableSVDModels();
  return models.find((m) => m.id === modelVersion);
}
