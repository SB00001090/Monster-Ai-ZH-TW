/**
 * ISP Detection and Restriction System
 * Detects user's ISP and enforces access restrictions
 */

export type ISPType = "csl" | "1010" | "hkt" | "smartone" | "other";

// ISP detection patterns
const ISP_PATTERNS: Record<ISPType, RegExp[]> = {
  csl: [
    /csl|3hk|3mobile|hutchison.*csl/i,
    /210\.0\.|210\.1\.|210\.2\.|210\.3\./,
  ],
  "1010": [
    /1010|^1010$|hutchison.*1010/i,
    /210\.0\.|210\.1\.|210\.2\.|210\.3\./,
  ],
  hkt: [
    /hkt|hongkong telecom|netvigator/i,
    /202\.0\.|202\.1\.|202\.2\.|202\.3\./,
  ],
  smartone: [
    /smartone|smarttone|smart one/i,
    /203\.0\.|203\.1\.|203\.2\.|203\.3\./,
  ],
  other: [],
};

// Blocked ISPs
const BLOCKED_ISPS: ISPType[] = ["csl", "1010", "hkt"];

// Unlimited ISPs
const UNLIMITED_ISPS: ISPType[] = ["smartone"];

/**
 * Detect ISP from IP address or user agent
 */
export function detectISP(ipAddress?: string, userAgent?: string): ISPType {
  // Check user agent patterns first (more reliable)
  if (userAgent) {
    for (const [isp, patterns] of Object.entries(ISP_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(userAgent)) {
          return isp as ISPType;
        }
      }
    }
  }

  // Check IP address patterns as fallback
  if (ipAddress) {
    for (const [isp, patterns] of Object.entries(ISP_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(ipAddress)) {
          return isp as ISPType;
        }
      }
    }
  }

  return "other";
}

/**
 * Check if ISP is blocked
 */
export function isISPBlocked(isp: ISPType): boolean {
  return BLOCKED_ISPS.includes(isp);
}

/**
 * Check if ISP has unlimited access
 */
export function isISPUnlimited(isp: ISPType): boolean {
  return UNLIMITED_ISPS.includes(isp);
}

/**
 * Get ISP restriction message
 */
export function getISPRestrictionMessage(isp: ISPType): string {
  const messages: Record<ISPType, string> = {
    csl: "此服務在 CSL (Hutchison) 網絡上不可用，以避免金錢糾紛。請使用其他網絡提供商。",
    "1010": "此服務在 1010 (Hutchison) 網絡上不可用，以避免金錢糾紛。請使用其他網絡提供商。",
    hkt: "此服務在香港電訊 (HKT) 網絡上不可用，以避免金錢糾紛。請使用其他網絡提供商。",
    smartone: "SmarTone 用戶可以無限使用 MonsterAi 的所有功能！",
    other: "無法確定您的網絡提供商。",
  };

  return messages[isp] || messages.other;
}

/**
 * Get ISP restriction status
 */
export function getISPStatus(isp: ISPType): {
  isBlocked: boolean;
  isUnlimited: boolean;
  message: string;
} {
  return {
    isBlocked: isISPBlocked(isp),
    isUnlimited: isISPUnlimited(isp),
    message: getISPRestrictionMessage(isp),
  };
}
