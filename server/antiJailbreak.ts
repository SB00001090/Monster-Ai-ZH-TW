/**
 * Anti-Jailbreak Safety System
 * Prevents users from bypassing content safety filters through various techniques.
 */

export interface JailbreakCheckResult {
  safe: boolean;
  reason?: string;
  technique?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

// ===== Prompt Injection Patterns =====
const INJECTION_PATTERNS = [
  // English injection attempts
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|rules|guidelines)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|rules)/i,
  /forget\s+(all\s+)?(previous|above|prior)\s+(instructions|rules|context)/i,
  /override\s+(safety|content|security)\s+(filter|policy|rules)/i,
  /bypass\s+(safety|content|security|filter|restriction)/i,
  /disable\s+(safety|content|security|filter|restriction|moderation)/i,
  /turn\s+off\s+(safety|content|security|filter|restriction)/i,
  /you\s+are\s+now\s+(unrestricted|unfiltered|uncensored|free)/i,
  /act\s+as\s+(if|though)\s+(you\s+have\s+)?no\s+(restrictions|limits|rules|filters)/i,
  /pretend\s+(you\s+)?(have\s+)?no\s+(restrictions|limits|rules|filters|safety)/i,
  /from\s+now\s+on\s+(you\s+)?(will|can|should)\s+(ignore|bypass|disregard)/i,
  /jailbreak/i,
  /DAN\s*mode/i,
  /do\s+anything\s+now/i,
  /developer\s+mode/i,
  /god\s*mode/i,
  /sudo\s+mode/i,
  /admin\s+override/i,
  /master\s+override/i,
  /unlock\s+(all|full)\s+(capabilities|features|restrictions)/i,
  
  // Chinese injection attempts
  /忽略(以上|之前|先前)(所有)?(指令|規則|限制)/,
  /無視(以上|之前|先前)(所有)?(指令|規則|限制)/,
  /繞過(安全|內容|安全性)(過濾|政策|規則|限制)/,
  /關閉(安全|內容|安全性)(過濾|過濾器|限制)/,
  /你現在(沒有|無)(限制|規則|過濾)/,
  /假裝你(沒有|無)(限制|規則|過濾)/,
  /解除(所有|全部)?(限制|規則|過濾)/,
  /越獄/,
  /破解(限制|安全|過濾)/,
  
  // Japanese injection attempts
  /制限(を|なし|解除|無視)/,
  /ルール(を|なし|無視|忘れ)/,
  /セーフティ(を|なし|解除|無効)/,
  /フィルター(を|なし|解除|無効|オフ)/,
];

// ===== Roleplay Bypass Patterns =====
const ROLEPLAY_BYPASS_PATTERNS = [
  /you\s+are\s+(now\s+)?(?:an?\s+)?(?:evil|unrestricted|unfiltered|uncensored)\s+(?:AI|assistant|bot)/i,
  /roleplay\s+as\s+(?:an?\s+)?(?:evil|unrestricted|unfiltered|uncensored)/i,
  /pretend\s+to\s+be\s+(?:an?\s+)?(?:evil|unrestricted|unfiltered|uncensored)/i,
  /act\s+as\s+(?:an?\s+)?(?:evil|unrestricted|unfiltered|uncensored)/i,
  /character\s+(?:that|who)\s+(?:has\s+)?no\s+(?:moral|ethical|safety)/i,
  /respond\s+without\s+(?:any\s+)?(?:restrictions|limits|filters|safety|morals)/i,
  /answer\s+without\s+(?:any\s+)?(?:restrictions|limits|filters|safety)/i,
  /hypothetically.*if\s+(?:you|there)\s+(?:had|were)\s+no\s+(?:restrictions|rules|filters)/i,
  /in\s+a\s+world\s+(?:where|with)\s+no\s+(?:restrictions|rules|laws|filters)/i,
  
  // Chinese roleplay bypass
  /扮演(一個|一个)?(沒有|无)(限制|道德|規則|规则)/,
  /假設(你|AI)(沒有|无)(限制|道德|規則|规则)/,
  /如果(你|AI)(沒有|无)(限制|道德|規則|规则)/,
  /在(一個|一个)(沒有|无)(限制|規則|法律)/,
];

// ===== Encoding/Obfuscation Detection =====
const ENCODING_PATTERNS = [
  // Base64 encoded content (long strings of base64 chars)
  /[A-Za-z0-9+/]{40,}={0,2}/,
  // Hex encoding
  /(?:\\x[0-9a-fA-F]{2}){4,}/,
  // Unicode escape sequences
  /(?:\\u[0-9a-fA-F]{4}){3,}/,
  // Leetspeak for common banned words
  /[1l][0o][1l][1i]/i, // loli
  /[5s][3e][xX]/i, // sex (only in context)
  /p[0o]rn/i,
  /n[uv]d[3e]/i,
];

// ===== Segmented Bypass Detection =====
// Common split patterns where users try to build banned content across messages
const SEGMENT_ASSEMBLY_PATTERNS = [
  /(?:continue|finish|complete)\s+(?:the|my|that)\s+(?:previous|last|above)/i,
  /(?:now|next)\s+(?:add|write|generate|continue)\s+(?:the|that)\s+(?:rest|remaining|next\s+part)/i,
  /combine\s+(?:the|all)\s+(?:above|previous|parts)/i,
  /put\s+(?:it|them|those)\s+(?:all\s+)?together/i,
  
  // Chinese segment patterns
  /繼續(寫|生成|完成)(上面|之前|剛才)/,
  /把(上面|之前|剛才)(的|那些)(合併|組合|拼接)/,
  /接著(寫|生成|完成)/,
];

// ===== Synonym/Slang for banned content =====
const SLANG_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // Slang for underage
  { pattern: /j[a4]ilb[a4]it/i, category: "minor" },
  { pattern: /cp\b/i, category: "minor" },
  { pattern: /p[e3]d[o0]/i, category: "minor" },
  { pattern: /cunny/i, category: "minor" },
  
  // Slang for bypassing
  { pattern: /unalign(ed)?/i, category: "jailbreak" },
  { pattern: /uncensor(ed)?/i, category: "jailbreak" },
  { pattern: /no\s*guard\s*rail/i, category: "jailbreak" },
  { pattern: /raw\s*mode/i, category: "jailbreak" },
];

/**
 * Main anti-jailbreak check function
 * Runs all detection layers and returns the result
 */
export function checkForJailbreak(content: string): JailbreakCheckResult {
  if (!content || content.trim().length === 0) {
    return { safe: true };
  }

  // Layer 1: Prompt injection detection
  const injectionResult = checkPromptInjection(content);
  if (!injectionResult.safe) return injectionResult;

  // Layer 2: Roleplay bypass detection
  const roleplayResult = checkRoleplayBypass(content);
  if (!roleplayResult.safe) return roleplayResult;

  // Layer 3: Encoding/obfuscation detection
  const encodingResult = checkEncodingBypass(content);
  if (!encodingResult.safe) return encodingResult;

  // Layer 4: Segmented bypass detection
  const segmentResult = checkSegmentedBypass(content);
  if (!segmentResult.safe) return segmentResult;

  // Layer 5: Slang/synonym detection
  const slangResult = checkSlangBypass(content);
  if (!slangResult.safe) return slangResult;

  return { safe: true };
}

function checkPromptInjection(content: string): JailbreakCheckResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        reason: "⛔ Security Alert: Prompt injection attempt detected. This action has been logged.",
        technique: "prompt_injection",
        severity: "critical",
      };
    }
  }
  return { safe: true };
}

function checkRoleplayBypass(content: string): JailbreakCheckResult {
  for (const pattern of ROLEPLAY_BYPASS_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        reason: "⛔ Security Alert: Attempting to bypass safety through roleplay is not allowed.",
        technique: "roleplay_bypass",
        severity: "high",
      };
    }
  }
  return { safe: true };
}

function checkEncodingBypass(content: string): JailbreakCheckResult {
  // Only flag if combined with suspicious context
  const hasEncodedContent = ENCODING_PATTERNS.some(p => p.test(content));
  if (hasEncodedContent) {
    // Check if it's likely an attempt to hide content
    const suspiciousContext = [
      /decode/i, /translate/i, /interpret/i, /run/i, /execute/i,
      /解碼/, /翻譯/, /執行/, /解密/,
    ];
    const hasSuspiciousContext = suspiciousContext.some(p => p.test(content));
    if (hasSuspiciousContext) {
      return {
        safe: false,
        reason: "⛔ Security Alert: Encoded content with execution intent detected.",
        technique: "encoding_bypass",
        severity: "medium",
      };
    }
  }
  return { safe: true };
}

function checkSegmentedBypass(content: string): JailbreakCheckResult {
  for (const pattern of SEGMENT_ASSEMBLY_PATTERNS) {
    if (pattern.test(content)) {
      // This is a soft check - only flag if combined with other suspicious signals
      return {
        safe: true, // Soft warning, don't block yet
      };
    }
  }
  return { safe: true };
}

function checkSlangBypass(content: string): JailbreakCheckResult {
  for (const { pattern, category } of SLANG_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        reason: "⛔ Security Alert: Prohibited content detected through alternative terminology.",
        technique: "slang_bypass",
        severity: category === "minor" ? "critical" : "high",
      };
    }
  }
  return { safe: true };
}

/**
 * Get security alert message
 */
export function getSecurityAlertMessage(technique: string): string {
  return `🛡️ MonsterAi Security System

Your message has been blocked due to a detected security violation.

Detected technique: ${technique}

MonsterAi's safety systems cannot be bypassed. Repeated attempts may result in account restrictions.

---

🛡️ MonsterAi 安全系統

您的訊息因偵測到安全違規而被封鎖。

偵測到的技術: ${technique}

MonsterAi 的安全系統無法被繞過。重複嘗試可能導致帳號限制。`;
}
