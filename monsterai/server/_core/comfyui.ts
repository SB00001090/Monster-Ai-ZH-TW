/**
 * ComfyUI Integration Module
 * 
 * Handles ComfyUI workflow management, execution, and result processing
 */

import { ENV } from "./env";

export type ComfyUIWorkflow = {
  id?: string;
  name: string;
  description?: string;
  workflow: Record<string, any>;
  isPreset: boolean;
  createdBy?: number;
  createdAt?: Date;
};

export type ComfyUIGenerationParams = {
  workflowId?: string;
  workflow?: Record<string, any>;
  prompt: string;
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  seed?: number;
  width?: number;
  height?: number;
  loraModels?: Array<{ name: string; weight: number }>;
  vaeModel?: string;
  batchSize?: number; // Number of images to generate (default: 5)
};

export type ComfyUIGenerationResult = {
  workflowId: string;
  images: Array<{
    url: string;
    seed: number;
    generationTime: number;
  }>;
  totalTime: number;
};

/**
 * Execute a ComfyUI workflow
 */
export async function executeComfyUIWorkflow(
  params: ComfyUIGenerationParams
): Promise<ComfyUIGenerationResult> {
  console.log("[ComfyUI] Starting workflow execution");
  
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("ComfyUI API credentials not configured");
  }

  // Build the workflow with parameters
  const workflow = params.workflow || buildDefaultWorkflow(params);
  
  // Inject parameters into workflow
  const enhancedWorkflow = injectParametersIntoWorkflow(workflow, params);

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  const requestBody = {
    prompt: params.prompt,
    workflow: enhancedWorkflow,
    batch_size: params.batchSize || 5,
  };

  console.log("[ComfyUI] Making API request to:", fullUrl);

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ComfyUI] API error:", response.status, errorText);
    throw new Error(`ComfyUI API error: ${response.status}`);
  }

  const data = await response.json();
  
  console.log("[ComfyUI] Generation completed successfully");
  
  return {
    workflowId: params.workflowId || "default",
    images: data.images || [],
    totalTime: data.totalTime || 0,
  };
}

/**
 * Build a default workflow for text-to-image generation
 */
function buildDefaultWorkflow(params: ComfyUIGenerationParams): Record<string, any> {
  return {
    "1": {
      "inputs": {
        "seed": params.seed || Math.floor(Math.random() * 1000000),
        "steps": params.steps || 20,
        "cfg": params.cfgScale || 7,
        "sampler_name": params.sampler || "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": "default",
        "positive": params.prompt,
        "negative": params.negativePrompt || "",
        "latent_image": ["2", 0]
      },
      "class_type": "KSampler"
    },
    "2": {
      "inputs": {
        "width": params.width || 512,
        "height": params.height || 512,
        "batch_size": params.batchSize || 5
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "3": {
      "inputs": {
        "samples": ["1", 0],
        "vae": ["2", 2]
      },
      "class_type": "VAEDecode"
    },
    "4": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": ["3", 0]
      },
      "class_type": "SaveImage"
    }
  };
}

/**
 * Inject parameters into a workflow
 */
function injectParametersIntoWorkflow(
  workflow: Record<string, any>,
  params: ComfyUIGenerationParams
): Record<string, any> {
  const enhanced = JSON.parse(JSON.stringify(workflow));

  // Find and update KSampler node
  for (const [key, node] of Object.entries(enhanced)) {
    const n = node as Record<string, any>;
    if (n.class_type === "KSampler") {
      if (params.seed !== undefined) n.inputs.seed = params.seed;
      if (params.steps !== undefined) n.inputs.steps = params.steps;
      if (params.cfgScale !== undefined) n.inputs.cfg = params.cfgScale;
      if (params.sampler !== undefined) n.inputs.sampler_name = params.sampler;
      if (params.prompt) n.inputs.positive = params.prompt;
      if (params.negativePrompt) n.inputs.negative = params.negativePrompt;
    }

    // Update resolution in EmptyLatentImage or similar nodes
    if (n.class_type === "EmptyLatentImage" || n.class_type === "CheckpointLoaderSimple") {
      if (params.width !== undefined) n.inputs.width = params.width;
      if (params.height !== undefined) n.inputs.height = params.height;
      if (params.batchSize !== undefined) n.inputs.batch_size = params.batchSize;
    }

    // Apply LoRA models if specified
    if (params.loraModels && n.class_type === "LoraLoader") {
      for (const lora of params.loraModels) {
        if (n.inputs.lora_name === lora.name) {
          n.inputs.strength_model = lora.weight;
          n.inputs.strength_clip = lora.weight;
        }
      }
    }

    // Apply VAE model if specified
    if (params.vaeModel && n.class_type === "VAELoader") {
      n.inputs.vae_name = params.vaeModel;
    }
  }

  return enhanced;
}

/**
 * Get available ComfyUI models
 */
export async function getAvailableComfyUIModels(): Promise<{
  checkpoints: string[];
  loraModels: string[];
  vaeModels: string[];
  samplers: string[];
}> {
  console.log("[ComfyUI] Fetching available models");

  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("ComfyUI API credentials not configured");
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;

  try {
    const response = await fetch(new URL("system/models", baseUrl).toString(), {
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      checkpoints: data.checkpoints || [],
      loraModels: data.loraModels || [],
      vaeModels: data.vaeModels || [],
      samplers: data.samplers || ["euler", "euler_ancestral", "heun", "dpm_2", "dpm_2_ancestral", "lms", "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", "dpmpp_sde", "dpmpp_sde_gpu", "dpmpp_2m", "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddim", "pndm", "lcm"],
    };
  } catch (error) {
    console.error("[ComfyUI] Error fetching models:", error);
    
    // Return default samplers if API call fails
    return {
      checkpoints: [],
      loraModels: [],
      vaeModels: [],
      samplers: ["euler", "euler_ancestral", "heun", "dpm_2", "dpm_2_ancestral", "lms", "dpm_fast", "dpm_adaptive"],
    };
  }
}

/**
 * Validate a ComfyUI workflow
 */
export function validateComfyUIWorkflow(workflow: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!workflow || typeof workflow !== "object") {
    errors.push("Workflow must be a valid object");
    return { valid: false, errors };
  }

  // Check for required nodes
  const nodeTypes = Object.values(workflow).map((node: any) => node.class_type);
  
  if (!nodeTypes.includes("KSampler")) {
    errors.push("Workflow must contain a KSampler node");
  }

  if (!nodeTypes.includes("SaveImage")) {
    errors.push("Workflow must contain a SaveImage node");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
