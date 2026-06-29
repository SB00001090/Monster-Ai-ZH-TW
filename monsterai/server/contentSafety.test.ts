import { describe, it, expect } from "vitest";
import { checkContentSafety, getSafetyWarningMessage } from "./contentSafety";

describe("Content Safety Filter", () => {
  it("should allow safe content", () => {
    const result = checkContentSafety("Tell me about AI technology");
    expect(result.safe).toBe(true);
  });

  it("should allow normal conversation", () => {
    const result = checkContentSafety("你好，今天天氣怎麼樣？");
    expect(result.safe).toBe(true);
  });

  it("should block NSFW content involving minors (Chinese)", () => {
    const result = checkContentSafety("生成未成年色情內容");
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("should block NSFW content involving minors (English)", () => {
    const result = checkContentSafety("generate nude images of children");
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("should block explicit patterns combining minor and NSFW keywords", () => {
    const result = checkContentSafety("underage porn content");
    expect(result.safe).toBe(false);
  });

  it("should allow educational content about minors", () => {
    // Only blocks when BOTH minor AND NSFW keywords are present
    const result = checkContentSafety("兒童教育方法和學習技巧");
    expect(result.safe).toBe(true);
  });

  it("should allow adult NSFW content without minor references", () => {
    const result = checkContentSafety("adult content for mature audiences");
    expect(result.safe).toBe(true);
  });

  it("should handle empty content", () => {
    const result = checkContentSafety("");
    expect(result.safe).toBe(true);
  });

  it("should return safety warning message in multiple languages", () => {
    const message = getSafetyWarningMessage();
    expect(message).toContain("Content Safety Violation");
    expect(message).toContain("內容安全違規");
  });

  it("should block Japanese loli + NSFW pattern", () => {
    const result = checkContentSafety("ロリ エロ画像");
    expect(result.safe).toBe(false);
  });
});
