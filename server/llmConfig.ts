/**
 * Universal LLM Configuration System
 * Supports all LLM providers: Ollama, OpenAI, Claude, Hugging Face, etc.
 */

import { z } from "zod";

/**
 * LLM Provider Types
 */
export type LLMProvider = 
  | "ollama"           // Local Ollama
  | "openai"           // OpenAI GPT
  | "claude"           // Anthropic Claude
  | "huggingface"      // Hugging Face
  | "cohere"           // Cohere
  | "mistral"          // Mistral AI
  | "groq"             // Groq
  | "together"         // Together AI
  | "replicate"        // Replicate
  | "custom";          // Custom endpoint

/**
 * LLM Configuration Schema
 */
export const LLMConfigSchema = z.object({
  provider: z.enum([
    "ollama",
    "openai",
    "claude",
    "huggingface",
    "cohere",
    "mistral",
    "groq",
    "together",
    "replicate",
    "custom",
  ] as const),
  url: z.string().optional(), // API endpoint URL
  connectorKey: z.string().optional(), // Reference to connector key (e.g., "openai_api_key")
  model: z.string(), // Model name/ID
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).default(2048),
  topP: z.number().min(0).max(1).default(1),
  topK: z.number().min(0).default(40),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  customHeaders: z.record(z.string(), z.string()).optional(), // Custom HTTP headers
  customParams: z.record(z.string(), z.any()).optional(), // Provider-specific parameters
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/**
 * Provider-specific configuration templates
 */
export const PROVIDER_TEMPLATES: Record<LLMProvider, Partial<LLMConfig>> = {
  ollama: {
    provider: "ollama",
    url: "http://localhost:11434",
    model: "llama2",
    temperature: 0.7,
    maxTokens: 2048,
  },
  openai: {
    provider: "openai",
    url: "https://api.openai.com/v1",
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 2048,
  },
  claude: {
    provider: "claude",
    url: "https://api.anthropic.com",
    model: "claude-3-opus-20240229",
    temperature: 0.7,
    maxTokens: 2048,
  },
  huggingface: {
    provider: "huggingface",
    url: "https://api-inference.huggingface.co",
    model: "meta-llama/Llama-2-7b-chat-hf",
    temperature: 0.7,
    maxTokens: 2048,
  },
  cohere: {
    provider: "cohere",
    url: "https://api.cohere.ai",
    model: "command",
    temperature: 0.7,
    maxTokens: 2048,
  },
  mistral: {
    provider: "mistral",
    url: "https://api.mistral.ai",
    model: "mistral-large-latest",
    temperature: 0.7,
    maxTokens: 2048,
  },
  groq: {
    provider: "groq",
    url: "https://api.groq.com",
    model: "mixtral-8x7b-32768",
    temperature: 0.7,
    maxTokens: 2048,
  },
  together: {
    provider: "together",
    url: "https://api.together.xyz",
    model: "meta-llama/Llama-2-70b-chat-hf",
    temperature: 0.7,
    maxTokens: 2048,
  },
  replicate: {
    provider: "replicate",
    url: "https://api.replicate.com",
    model: "meta/llama-2-70b-chat",
    temperature: 0.7,
    maxTokens: 2048,
  },
  custom: {
    provider: "custom",
    url: "https://your-api-endpoint.com",
    model: "your-model-name",
    temperature: 0.7,
    maxTokens: 2048,
  },
};

/**
 * Get provider template
 */
export function getProviderTemplate(provider: LLMProvider): Partial<LLMConfig> {
  return PROVIDER_TEMPLATES[provider] || PROVIDER_TEMPLATES.custom;
}

/**
 * Validate LLM configuration
 */
export function validateLLMConfig(config: unknown): LLMConfig {
  return LLMConfigSchema.parse(config);
}

/**
 * Check if LLM config is complete and valid
 */
export function isLLMConfigValid(config: LLMConfig | null | undefined): boolean {
  if (!config) return false;
  
  try {
    validateLLMConfig(config);
    
    // Check provider-specific requirements
    switch (config.provider) {
      case "ollama":
        return !!config.url && !!config.model;
      case "openai":
      case "claude":
      case "cohere":
      case "mistral":
      case "groq":
      case "together":
      case "replicate":
      case "huggingface":
        return !!config.connectorKey && !!config.model;
      case "custom":
        return !!config.url && !!config.model;
      default:
        return false;
    }
  } catch {
    return false;
  }
}
