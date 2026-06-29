/**
 * Prompt Analyzer for automatic SD image generation detection
 * Analyzes user messages to detect English prompts with weights for Stable Diffusion
 */

export interface PromptAnalysis {
  isSDPrompt: boolean;
  prompt: string;
  weights: Record<string, number>;
  confidence: number;
  originalText: string;
}

/**
 * Regex patterns for detecting weighted prompts
 * Supports formats like:
 * - "a cat (fluffy:1.5) on a (sunny:0.8) day"
 * - "beautiful landscape, (mountains:1.2), (sunset:0.9)"
 */
const WEIGHTED_PATTERN = /\([^)]+:[0-9.]+\)/g;
const WEIGHT_EXTRACTION = /\(([^:)]+):([0-9.]+)\)/;

/**
 * Analyze a message to detect if it contains an SD prompt with weights
 */
export function analyzePrompt(text: string): PromptAnalysis {
  const trimmedText = text.trim();
  
  // Check if text contains weighted syntax
  const hasWeights = WEIGHTED_PATTERN.test(trimmedText);
  
  if (!hasWeights) {
    return {
      isSDPrompt: false,
      prompt: "",
      weights: {},
      confidence: 0,
      originalText: trimmedText,
    };
  }

  // Extract all weighted terms
  const weights: Record<string, number> = {};
  let cleanPrompt = trimmedText;
  let matchCount = 0;

  const matches = trimmedText.match(WEIGHTED_PATTERN);
  if (matches) {
    matches.forEach((match) => {
      const weightMatch = match.match(WEIGHT_EXTRACTION);
      if (weightMatch) {
        const [, term, weight] = weightMatch;
        weights[term.trim()] = parseFloat(weight);
        matchCount++;
      }
    });

    // Remove weighted syntax from prompt for display
    cleanPrompt = trimmedText.replace(WEIGHTED_PATTERN, (match) => {
      const weightMatch = match.match(WEIGHT_EXTRACTION);
      return weightMatch ? weightMatch[1] : match;
    });
  }

  // Confidence calculation based on:
  // - Number of weighted terms (higher = more confident)
  // - Text length (very short prompts are less confident)
  const weightCount = Object.keys(weights).length;
  const confidence = Math.min(
    1.0,
    (weightCount * 0.3 + (cleanPrompt.length > 20 ? 0.7 : 0.3))
  );

  return {
    isSDPrompt: confidence > 0.5,
    prompt: cleanPrompt.trim(),
    weights,
    confidence,
    originalText: trimmedText,
  };
}

/**
 * Extract SD generation parameters from analyzed prompt
 */
export interface SDGenerationParams {
  prompt: string;
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  seed?: number;
}

/**
 * Parse advanced SD parameters from prompt text
 * Supports formats like:
 * - "prompt [negative: bad quality]"
 * - "prompt [steps: 25]"
 * - "prompt [cfg: 7.5]"
 */
export function extractSDParameters(
  analysis: PromptAnalysis
): SDGenerationParams {
  const params: SDGenerationParams = {
    prompt: analysis.prompt,
  };

  const text = analysis.originalText;

  // Extract negative prompt
  const negativeMatch = text.match(/\[negative:\s*([^\]]+)\]/i);
  if (negativeMatch) {
    params.negativePrompt = negativeMatch[1].trim();
  }

  // Extract steps
  const stepsMatch = text.match(/\[steps:\s*(\d+)\]/i);
  if (stepsMatch) {
    const steps = parseInt(stepsMatch[1]);
    if (steps >= 1 && steps <= 150) {
      params.steps = steps;
    }
  }

  // Extract CFG scale
  const cfgMatch = text.match(/\[cfg:\s*([0-9.]+)\]/i);
  if (cfgMatch) {
    const cfg = parseFloat(cfgMatch[1]);
    if (cfg >= 1 && cfg <= 20) {
      params.cfgScale = cfg;
    }
  }

  // Extract sampler
  const samplerMatch = text.match(/\[sampler:\s*([^\]]+)\]/i);
  if (samplerMatch) {
    params.sampler = samplerMatch[1].trim();
  }

  // Extract seed
  const seedMatch = text.match(/\[seed:\s*(\d+)\]/i);
  if (seedMatch) {
    params.seed = parseInt(seedMatch[1]);
  }

  return params;
}

/**
 * Validate if a prompt is suitable for SD generation
 */
export function isValidSDPrompt(analysis: PromptAnalysis): boolean {
  if (!analysis.isSDPrompt) {
    return false;
  }

  // Check minimum prompt length
  if (analysis.prompt.length < 5) {
    return false;
  }

  // Check if prompt contains mostly English characters
  const englishCharCount = (analysis.prompt.match(/[a-zA-Z0-9\s,.:;-]/g) || [])
    .length;
  const englishRatio = englishCharCount / analysis.prompt.length;

  return englishRatio > 0.7;
}

/**
 * Format weights for SD API
 */
export function formatWeightsForSD(weights: Record<string, number>): string {
  return Object.entries(weights)
    .map(([term, weight]) => `(${term}:${weight})`)
    .join(" ");
}

/**
 * Check if message should trigger automatic SD generation
 */
export function shouldAutoGenerateSD(text: string): boolean {
  const analysis = analyzePrompt(text);
  return isValidSDPrompt(analysis);
}

/**
 * Get SD generation info from message
 */
export function getSDGenerationInfo(text: string) {
  const analysis = analyzePrompt(text);
  
  if (!shouldAutoGenerateSD(text)) {
    return null;
  }

  const params = extractSDParameters(analysis);
  
  return {
    analysis,
    params,
    formattedPrompt: `${params.prompt} ${formatWeightsForSD(analysis.weights)}`.trim(),
  };
}
