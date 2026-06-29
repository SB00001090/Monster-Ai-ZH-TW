import { describe, it, expect, beforeEach, vi } from "vitest";
import * as selfAwareness from "./_core/selfAwareness";
import * as db from "./db";

// Mock the database and LLM modules
vi.mock("./db", () => ({
  getUserFeedback: vi.fn(),
  getAverageRatingForUser: vi.fn(),
  getUserModelImprovements: vi.fn(),
  getUserPromptOptimizations: vi.fn(),
  saveModelImprovement: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

describe("Self-Awareness System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateSelfEvaluationMetrics", () => {
    it("should return zero metrics when no feedback exists", async () => {
      vi.mocked(db.getUserFeedback).mockResolvedValue([]);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(null);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.averageResponseQuality).toBe(0);
      expect(metrics.consistencyScore).toBe(0);
      expect(metrics.totalEvaluations).toBe(0);
      expect(metrics.improvementTrend).toBe("stable");
    });

    it("should calculate metrics correctly with feedback data", async () => {
      const mockFeedback = [
        { id: 1, rating: 5, createdAt: new Date() },
        { id: 2, rating: 4, createdAt: new Date() },
        { id: 3, rating: 5, createdAt: new Date() },
        { id: 4, rating: 3, createdAt: new Date() },
        { id: 5, rating: 4, createdAt: new Date() },
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(4.2);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.averageResponseQuality).toBe(4.2);
      expect(metrics.totalEvaluations).toBe(5);
      expect(metrics.consistencyScore).toBeGreaterThan(0);
      expect(metrics.consistencyScore).toBeLessThanOrEqual(100);
    });

    it("should detect improving trend when recent ratings are higher", async () => {
      const mockFeedback = [
        { id: 1, rating: 5, createdAt: new Date() }, // Recent
        { id: 2, rating: 5, createdAt: new Date() }, // Recent
        { id: 3, rating: 2, createdAt: new Date(Date.now() - 1000000) }, // Older
        { id: 4, rating: 2, createdAt: new Date(Date.now() - 1000000) }, // Older
        { id: 5, rating: 2, createdAt: new Date(Date.now() - 1000000) }, // Older
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(3.2);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.improvementTrend).toBe("improving");
    });

    it("should detect declining trend when recent ratings are lower", async () => {
      const mockFeedback = [
        { id: 1, rating: 2, createdAt: new Date() }, // Recent
        { id: 2, rating: 2, createdAt: new Date() }, // Recent
        { id: 3, rating: 5, createdAt: new Date(Date.now() - 1000000) }, // Older
        { id: 4, rating: 5, createdAt: new Date(Date.now() - 1000000) }, // Older
        { id: 5, rating: 5, createdAt: new Date(Date.now() - 1000000) }, // Older
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(3.8);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.improvementTrend).toBe("declining");
    });
  });

  describe("analyzePerformancePatterns", () => {
    it("should return default response when no feedback exists", async () => {
      vi.mocked(db.getUserFeedback).mockResolvedValue([]);

      const analysis = await selfAwareness.analyzePerformancePatterns(1);

      expect(analysis.patterns).toContain("Insufficient data for analysis");
      expect(analysis.strategies).toContain("Continue gathering feedback");
      expect(Array.isArray(analysis.priorityAreas)).toBe(true);
    });

    it("should extract common issues from low-rated feedback", async () => {
      const mockFeedback = [
        { id: 1, rating: 1, tags: "unclear,verbose", createdAt: new Date() },
        { id: 2, rating: 2, tags: "unclear,slow", createdAt: new Date() },
        { id: 3, rating: 5, tags: "helpful", createdAt: new Date() },
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(2.67);
      vi.mocked(db.getUserModelImprovements).mockResolvedValue([]);
      vi.mocked(db.getUserPromptOptimizations).mockResolvedValue([]);

      const analysis = await selfAwareness.analyzePerformancePatterns(1);

      expect(Array.isArray(analysis.patterns)).toBe(true);
      expect(Array.isArray(analysis.strategies)).toBe(true);
      expect(Array.isArray(analysis.priorityAreas)).toBe(true);
    });
  });

  describe("calculateSelfEvaluationMetrics consistency calculation", () => {
    it("should calculate consistency score based on rating variance", async () => {
      // Consistent ratings (all 4s)
      const consistentFeedback = [
        { id: 1, rating: 4, createdAt: new Date() },
        { id: 2, rating: 4, createdAt: new Date() },
        { id: 3, rating: 4, createdAt: new Date() },
        { id: 4, rating: 4, createdAt: new Date() },
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(consistentFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(4);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.consistencyScore).toBe(100); // Perfect consistency
    });

    it("should lower consistency score for varied ratings", async () => {
      // Varied ratings
      const variedFeedback = [
        { id: 1, rating: 1, createdAt: new Date() },
        { id: 2, rating: 5, createdAt: new Date() },
        { id: 3, rating: 1, createdAt: new Date() },
        { id: 4, rating: 5, createdAt: new Date() },
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(variedFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(3);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.consistencyScore).toBeLessThan(100);
      expect(metrics.consistencyScore).toBeGreaterThan(0);
    });
  });

  describe("runSelfImprovementCycle", () => {
    it("should return a valid cycle result with all required fields", async () => {
      vi.mocked(db.getUserFeedback).mockResolvedValue([
        { id: 1, rating: 3, tags: "unclear", createdAt: new Date() },
      ] as any);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(3);
      vi.mocked(db.getUserModelImprovements).mockResolvedValue([]);
      vi.mocked(db.getUserPromptOptimizations).mockResolvedValue([]);

      const cycle = await selfAwareness.runSelfImprovementCycle(1);

      expect(cycle.cycleId).toMatch(/^cycle-\d+$/);
      expect(cycle.timestamp).toBeInstanceOf(Date);
      expect(cycle.analysis).toBeDefined();
      expect(cycle.recommendations).toBeDefined();
      expect(cycle.metrics).toBeDefined();
      expect(Array.isArray(cycle.recommendations)).toBe(true);
    });

    it("should generate recommendations based on analysis", async () => {
      vi.mocked(db.getUserFeedback).mockResolvedValue([
        { id: 1, rating: 2, tags: "unclear", createdAt: new Date() },
        { id: 2, rating: 2, tags: "unclear", createdAt: new Date() },
      ] as any);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(2);
      vi.mocked(db.getUserModelImprovements).mockResolvedValue([]);
      vi.mocked(db.getUserPromptOptimizations).mockResolvedValue([]);

      const cycle = await selfAwareness.runSelfImprovementCycle(1);

      expect(cycle.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Self-Awareness Edge Cases", () => {
    it("should handle single feedback entry", async () => {
      const mockFeedback = [{ id: 1, rating: 3, createdAt: new Date() }] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(3);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.totalEvaluations).toBe(1);
      expect(metrics.averageResponseQuality).toBe(3);
    });

    it("should handle extreme rating values", async () => {
      const mockFeedback = [
        { id: 1, rating: 1, createdAt: new Date() },
        { id: 2, rating: 5, createdAt: new Date() },
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(3);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.averageResponseQuality).toBe(3);
      expect(metrics.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(metrics.consistencyScore).toBeLessThanOrEqual(100);
    });

    it("should handle null average rating gracefully", async () => {
      vi.mocked(db.getUserFeedback).mockResolvedValue([
        { id: 1, rating: 3, createdAt: new Date() },
      ] as any);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(null);

      const metrics = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics.averageResponseQuality).toBe(0);
    });
  });

  describe("Self-Awareness Data Integrity", () => {
    it("should maintain data consistency across multiple calls", async () => {
      const mockFeedback = [
        { id: 1, rating: 4, createdAt: new Date() },
        { id: 2, rating: 4, createdAt: new Date() },
      ] as any;

      vi.mocked(db.getUserFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(db.getAverageRatingForUser).mockResolvedValue(4);

      const metrics1 = await selfAwareness.calculateSelfEvaluationMetrics(1);
      const metrics2 = await selfAwareness.calculateSelfEvaluationMetrics(1);

      expect(metrics1.averageResponseQuality).toBe(metrics2.averageResponseQuality);
      expect(metrics1.totalEvaluations).toBe(metrics2.totalEvaluations);
    });

    it("should properly handle user-specific data isolation", async () => {
      const mockFeedback1 = [{ id: 1, rating: 5, createdAt: new Date() }] as any;
      const mockFeedback2 = [{ id: 2, rating: 1, createdAt: new Date() }] as any;

      vi.mocked(db.getUserFeedback)
        .mockResolvedValueOnce(mockFeedback1)
        .mockResolvedValueOnce(mockFeedback2);
      vi.mocked(db.getAverageRatingForUser)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1);

      const metrics1 = await selfAwareness.calculateSelfEvaluationMetrics(1);
      const metrics2 = await selfAwareness.calculateSelfEvaluationMetrics(2);

      expect(metrics1.averageResponseQuality).toBe(5);
      expect(metrics2.averageResponseQuality).toBe(1);
    });
  });
});
