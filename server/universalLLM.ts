/**
 * Universal LLM Client
 * Supports all LLM providers with a unified interface
 */

import { LLMConfig, isLLMConfigValid } from "./llmConfig";
import { invokeLLM as invokeBuiltinLLM } from "./_core/llm";

export interface Message {
  role: "system" | "user" | "assistant" | "tool" | "function";
  content: string | any[];
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string | any[];
    };
  }>;
}

/**
 * Invoke LLM with user's configuration or fallback to built-in LLM
 */
export async function invokeLLMWithConfig(
  messages: Message[],
  userConfig: LLMConfig | null | undefined
): Promise<LLMResponse> {
  if (!isLLMConfigValid(userConfig)) {
    return invokeBuiltinLLM({ messages });
  }

  try {
    return await invokeProviderLLM(messages, userConfig as LLMConfig);
  } catch (error) {
    console.error("Error invoking user LLM, falling back to built-in LLM:", error);
    return invokeBuiltinLLM({ messages });
  }
}

/**
 * Invoke specific LLM provider
 */
async function invokeProviderLLM(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  switch (config.provider) {
    case "ollama":
      return invokeOllama(messages, config);
    case "openai":
      return invokeOpenAI(messages, config);
    case "claude":
      return invokeClaude(messages, config);
    case "huggingface":
      return invokeHuggingFace(messages, config);
    case "cohere":
      return invokeCohere(messages, config);
    case "mistral":
      return invokeMistral(messages, config);
    case "groq":
      return invokeGroq(messages, config);
    case "together":
      return invokeTogether(messages, config);
    case "replicate":
      return invokeReplicate(messages, config);
    case "custom":
      return invokeCustom(messages, config);
    default:
      throw new Error(`Unsupported LLM provider: ${(config as any).provider}`);
  }
}

/**
 * Ollama - Local LLM
 */
async function invokeOllama(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "http://localhost:11434";
  const model = config.model || "llama2";

  const response = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: config.temperature,
      top_p: config.topP,
      top_k: config.topK,
      num_predict: config.maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    choices: [
      {
        message: {
          content: data.message?.content || "",
        },
      },
    ],
  };
}

/**
 * OpenAI - GPT models
 */
async function invokeOpenAI(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "https://api.openai.com/v1";
  const model = config.model || "gpt-4";

  if (!config.connectorKey) throw new Error("OpenAI connector key is required");

  const response = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.connectorKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Claude - Anthropic
 */
async function invokeClaude(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "https://api.anthropic.com";
  const model = config.model || "claude-3-opus-20240229";

  if (!config.connectorKey) throw new Error("Claude connector key is required");

  const response = await fetch(`${url}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.connectorKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: config.maxTokens,
      messages: messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
      system: messages.find(m => m.role === "system")?.content,
      temperature: config.temperature,
      top_p: config.topP,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    choices: [
      {
        message: {
          content: data.content?.[0]?.text || "",
        },
      },
    ],
  };
}

/**
 * Hugging Face
 */
async function invokeHuggingFace(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "https://api-inference.huggingface.co";
  const model = config.model;

  if (!config.connectorKey) throw new Error("Hugging Face connector key is required");

  const response = await fetch(`${url}/models/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.connectorKey}`,
    },
    body: JSON.stringify({
      inputs: messages.map(m => `${m.role}: ${m.content}`).join("\n"),
      parameters: {
        temperature: config.temperature,
        max_length: config.maxTokens,
        top_p: config.topP,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Hugging Face API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    choices: [
      {
        message: {
          content: Array.isArray(data) ? data[0]?.generated_text || "" : data.generated_text || "",
        },
      },
    ],
  };
}

/**
 * Cohere
 */
async function invokeCohere(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "https://api.cohere.ai";
  const model = config.model || "command";

  if (!config.connectorKey) throw new Error("Cohere connector key is required");

  const response = await fetch(`${url}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.connectorKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        message: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      p: config.topP,
      k: config.topK,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cohere API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    choices: [
      {
        message: {
          content: data.text || "",
        },
      },
    ],
  };
}

/**
 * Mistral
 */
async function invokeMistral(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "https://api.mistral.ai";
  const model = config.model || "mistral-large-latest";

  if (!config.connectorKey) throw new Error("Mistral connector key is required");

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.connectorKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Groq
 */
async function invokeGroq(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "https://api.groq.com";
  const model = config.model || "mixtral-8x7b-32768";

  if (!config.connectorKey) throw new Error("Groq connector key is required");

  const response = await fetch(`${url}/openai/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.connectorKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Together AI
 */
async function invokeTogether(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url || "https://api.together.xyz";
  const model = config.model;

  if (!config.connectorKey) throw new Error("Together AI connector key is required");

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.connectorKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
    }),
  });

  if (!response.ok) {
    throw new Error(`Together AI API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Replicate
 */
async function invokeReplicate(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const model = config.model;

  if (!config.connectorKey) throw new Error("Replicate connector key is required");

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${config.connectorKey}`,
    },
    body: JSON.stringify({
      version: model,
      input: {
        prompt: messages.map(m => `${m.role}: ${m.content}`).join("\n"),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.statusText}`);
  }

  const data = await response.json();
  const output = data.output || [];
  return {
    choices: [
      {
        message: {
          content: Array.isArray(output) ? output.join("") : output.toString(),
        },
      },
    ],
  };
}

/**
 * Custom endpoint
 */
async function invokeCustom(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
  const url = config.url;

  if (!url) throw new Error("Custom LLM URL is required");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.customHeaders,
  };

  if (config.connectorKey) {
    headers["Authorization"] = `Bearer ${config.connectorKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      ...config.customParams,
    }),
  });

  if (!response.ok) {
    throw new Error(`Custom LLM API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Try to extract response in common formats
  if (data.choices?.[0]?.message?.content) {
    return data;
  } else if (data.message?.content) {
    return {
      choices: [{ message: { content: data.message.content } }],
    };
  } else if (data.content) {
    return {
      choices: [{ message: { content: data.content } }],
    };
  } else if (typeof data === "string") {
    return {
      choices: [{ message: { content: data } }],
    };
  }

  throw new Error("Unexpected response format from custom LLM");
}
