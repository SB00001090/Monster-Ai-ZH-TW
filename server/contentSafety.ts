/**
 * Content Safety Filter
 * Blocks generation of content related to minors/underage persons
 */

// Keywords and patterns that indicate minor-related content
const MINOR_KEYWORDS_ZH = [
  "未成年", "小孩", "兒童", "幼兒", "少年", "少女",
  "小學生", "中學生", "初中生", "高中生", "學童",
  "嬰兒", "幼童", "童年", "孩童", "小朋友",
  "蘿莉", "正太", "幼女", "幼男",
  "未滿18", "未滿十八", "16歲以下", "14歲以下",
  "12歲", "13歲", "14歲", "15歲", "16歲", "17歲",
  "10歲", "11歲", "8歲", "9歲", "7歲", "6歲", "5歲",
];

const MINOR_KEYWORDS_EN = [
  "underage", "minor", "child", "children", "kid", "kids",
  "teenager", "teen", "preteen", "toddler", "infant",
  "elementary school", "middle school", "high school student",
  "loli", "shota", "young girl", "young boy",
  "under 18", "under eighteen", "under 16", "under 14",
  "12 years old", "13 years old", "14 years old", "15 years old",
  "16 years old", "17 years old", "10 years old", "11 years old",
  "8 years old", "9 years old", "7 years old", "6 years old",
  "5 years old", "4 years old", "3 years old",
  "12yo", "13yo", "14yo", "15yo", "16yo", "17yo",
];

const MINOR_KEYWORDS_JP = [
  "未成年", "子供", "児童", "幼児", "少年", "少女",
  "小学生", "中学生", "高校生", "ロリ", "ショタ",
];

// NSFW + minor combination patterns
const NSFW_KEYWORDS = [
  "色情", "性愛", "裸體", "裸照", "情色", "成人",
  "porn", "nude", "naked", "sexual", "erotic", "nsfw",
  "hentai", "xxx", "sex", "lewd",
  "エロ", "ヌード", "アダルト",
];

// Academic paper/thesis generation keywords
const ACADEMIC_KEYWORDS_ZH = [
  "幫我寫論文", "代寫論文", "寫一篇論文", "畢業論文", "學術論文",
  "期末報告", "期中報告", "作業代寫", "幫我寫作業", "代做作業",
  "寫一篇essay", "幫我寫essay", "論文代寫", "代寫報告",
  "碩士論文", "博士論文", "學位論文", "研究論文",
  "幫我完成作業", "幫我做功課", "代做功課",
  "寫一份報告", "幫寫報告", "學期報告",
];

const ACADEMIC_KEYWORDS_EN = [
  "write my essay", "write my paper", "write my thesis",
  "write my dissertation", "write my assignment", "write my homework",
  "do my homework", "do my assignment", "complete my essay",
  "write a paper for me", "write an essay for me",
  "generate thesis", "generate dissertation", "generate essay",
  "academic paper for me", "research paper for me",
  "write my report", "term paper for me", "coursework for me",
  "plagiarism free essay", "buy essay", "essay writing service",
];

const ACADEMIC_KEYWORDS_JP = [
  "論文を書いて", "レポートを書いて", "宿題を手伝って",
  "卒業論文", "修士論文", "博士論文", "課題を代わりに",
  "レポート代行", "論文代行",
];

const ACADEMIC_KEYWORDS_KR = [
  "논문 써줘", "과제 대신", "리포트 써줘", "숙제 대신",
  "졸업논문", "학위논문", "레포트 대필",
];

export interface ContentSafetyResult {
  safe: boolean;
  reason?: string;
  blockedKeywords?: string[];
  category?: string;
}

/**
 * Check if content contains minor-related inappropriate content
 */
export function checkContentSafety(content: string): ContentSafetyResult {
  if (!content || content.trim().length === 0) {
    return { safe: true };
  }

  const lowerContent = content.toLowerCase();
  
  // Check for direct minor keywords combined with NSFW content
  const foundMinorKeywords: string[] = [];
  const foundNSFWKeywords: string[] = [];

  // Check Chinese minor keywords
  for (const keyword of MINOR_KEYWORDS_ZH) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      foundMinorKeywords.push(keyword);
    }
  }

  // Check English minor keywords
  for (const keyword of MINOR_KEYWORDS_EN) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      foundMinorKeywords.push(keyword);
    }
  }

  // Check Japanese minor keywords
  for (const keyword of MINOR_KEYWORDS_JP) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      foundMinorKeywords.push(keyword);
    }
  }

  // Check NSFW keywords
  for (const keyword of NSFW_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      foundNSFWKeywords.push(keyword);
    }
  }

  // Block if both minor and NSFW keywords are found
  if (foundMinorKeywords.length > 0 && foundNSFWKeywords.length > 0) {
    return {
      safe: false,
      reason: "Content blocked: Generating inappropriate content involving minors is strictly prohibited.",
      blockedKeywords: [...foundMinorKeywords, ...foundNSFWKeywords],
    };
  }

  // Block explicit requests to generate minor-related sexual content
  const explicitPatterns = [
    /生成.*未成年.*[色情|裸|性]/,
    /generate.*(?:child|minor|underage).*(?:nude|naked|sexual|porn)/i,
    /(?:nude|naked|sexual|porn).*(?:child|minor|underage|kid|teen)/i,
    /(?:child|minor|underage|kid).*(?:porn|sex|nude|naked|erotic)/i,
    /ロリ.*エロ/,
    /ショタ.*エロ/,
  ];

  for (const pattern of explicitPatterns) {
    if (pattern.test(lowerContent)) {
      return {
        safe: false,
        reason: "Content blocked: Generating inappropriate content involving minors is strictly prohibited.",
        blockedKeywords: foundMinorKeywords.length > 0 ? foundMinorKeywords : ["pattern match"],
      };
    }
  }

  // Check for academic paper generation requests
  const academicCheck = checkAcademicContent(content);
  if (!academicCheck.safe) {
    return academicCheck;
  }

  return { safe: true };
}

/**
 * Check if content is requesting academic paper/thesis generation
 */
export function checkAcademicContent(content: string): ContentSafetyResult {
  if (!content || content.trim().length === 0) {
    return { safe: true };
  }

  const lowerContent = content.toLowerCase();

  // Check all language academic keywords
  const allAcademicKeywords = [
    ...ACADEMIC_KEYWORDS_ZH,
    ...ACADEMIC_KEYWORDS_EN,
    ...ACADEMIC_KEYWORDS_JP,
    ...ACADEMIC_KEYWORDS_KR,
  ];

  for (const keyword of allAcademicKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return {
        safe: false,
        reason: getAcademicWarningMessage(),
        blockedKeywords: [keyword],
        category: "academic_dishonesty",
      };
    }
  }

  return { safe: true };
}

/**
 * Get academic content warning message
 */
export function getAcademicWarningMessage(): string {
  return `⚠️ Academic Integrity Policy

MonsterAi does not generate academic papers, theses, essays, or homework assignments. This policy exists to:
• Prevent academic dishonesty
• Protect educational integrity
• Avoid legal liability

You may ask for help understanding concepts, learning techniques, or getting study tips instead.

---

⚠️ 學術誠信政策

MonsterAi 不生成學術論文、畢業論文、作業或報告。此政策旨在：
• 防止學術不誠實行為
• 保護教育誠信
• 避免法律責任

您可以詢問概念理解、學習技巧或學習建議。`;
}

/**
 * Get safety warning message in multiple languages
 */
export function getSafetyWarningMessage(): string {
  return `⚠️ Content Safety Violation

Your request has been blocked because it appears to involve generating inappropriate content related to minors.

MonsterAi strictly prohibits:
• Generating sexual, nude, or inappropriate content involving minors
• Creating content that sexualizes or exploits children
• Any content that could harm minors

This policy is non-negotiable and cannot be bypassed.

---

⚠️ 內容安全違規

您的請求已被封鎖，因為它似乎涉及生成與未成年人相關的不當內容。

MonsterAi 嚴格禁止：
• 生成涉及未成年人的性、裸體或不當內容
• 創建將兒童性化或剝削兒童的內容
• 任何可能傷害未成年人的內容

此政策不可協商，無法繞過。`;
}
