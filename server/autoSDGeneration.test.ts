import { describe, it, expect } from "vitest";
import {
  analyzePrompt,
  extractSDParameters,
  isValidSDPrompt,
  shouldAutoGenerateSD,
  getSDGenerationInfo,
} from "./promptAnalyzer";

describe("Auto SD Generation - Prompt Analyzer", () => {
  describe("analyzePrompt", () => {
    it("should detect weighted prompts", () => {
      const text = "a cat (fluffy:1.5) on a (sunny:0.8) day";
      const result = analyzePrompt(text);

      expect(result.isSDPrompt).toBe(true);
      expect(result.weights).toEqual({
        fluffy: 1.5,
        sunny: 0.8,
      });
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should return false for non-weighted prompts", () => {
      const text = "a simple cat picture";
      const result = analyzePrompt(text);

      expect(result.isSDPrompt).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should handle multiple weights", () => {
      const text = "beautiful (landscape:1.2), (mountains:1.1), (sunset:0.9)";
      const result = analyzePrompt(text);

      expect(result.isSDPrompt).toBe(true);
      expect(Object.keys(result.weights).length).toBe(3);
    });
  });

  describe("extractSDParameters", () => {
    it("should extract negative prompt", () => {
      const analysis = analyzePrompt("a cat (fluffy:1.5) [negative: blurry, low quality]");
      const params = extractSDParameters(analysis);

      expect(params.negativePrompt).toBe("blurry, low quality");
    });

    it("should extract steps parameter", () => {
      const analysis = analyzePrompt("a cat (fluffy:1.5) [steps: 30]");
      const params = extractSDParameters(analysis);

      expect(params.steps).toBe(30);
    });

    it("should extract CFG scale", () => {
      const analysis = analyzePrompt("a cat (fluffy:1.5) [cfg: 7.5]");
      const params = extractSDParameters(analysis);

      expect(params.cfgScale).toBe(7.5);
    });

    it("should extract seed", () => {
      const analysis = analyzePrompt("a cat (fluffy:1.5) [seed: 12345]");
      const params = extractSDParameters(analysis);

      expect(params.seed).toBe(12345);
    });

    it("should extract all parameters together", () => {
      const text = "a cat (fluffy:1.5) [negative: bad] [steps: 25] [cfg: 8] [seed: 999]";
      const analysis = analyzePrompt(text);
      const params = extractSDParameters(analysis);

      expect(params.negativePrompt).toBe("bad");
      expect(params.steps).toBe(25);
      expect(params.cfgScale).toBe(8);
      expect(params.seed).toBe(999);
    });
  });

  describe("isValidSDPrompt", () => {
    it("should validate proper SD prompts", () => {
      const analysis = analyzePrompt("a beautiful cat (fluffy:1.5) in a garden");
      expect(isValidSDPrompt(analysis)).toBe(true);
    });

    it("should reject non-SD prompts", () => {
      const analysis = analyzePrompt("hello");
      expect(isValidSDPrompt(analysis)).toBe(false);
    });

    it("should reject prompts with non-English text", () => {
      const analysis = analyzePrompt("一隻貓 (fluffy:1.5)");
      expect(isValidSDPrompt(analysis)).toBe(false);
    });
  });

  describe("shouldAutoGenerateSD", () => {
    it("should return true for valid SD prompts", () => {
      const text = "a dog (happy:1.2) playing in the park";
      expect(shouldAutoGenerateSD(text)).toBe(true);
    });

    it("should return false for regular messages", () => {
      const text = "How are you doing today?";
      expect(shouldAutoGenerateSD(text)).toBe(false);
    });
  });

  describe("getSDGenerationInfo", () => {
    it("should return null for non-SD prompts", () => {
      const text = "Just a regular message";
      expect(getSDGenerationInfo(text)).toBeNull();
    });

    it("should return generation info for valid prompts", () => {
      const text = "a cat (fluffy:1.5) [steps: 20]";
      const info = getSDGenerationInfo(text);

      expect(info).not.toBeNull();
      if (info) {
        expect(info.formattedPrompt).toContain("cat");
        expect(info.params.steps).toBe(20);
      }
    });
  });
});
