/**
 * Access Control System
 * - Block university IP addresses
 * - Block high-risk scam countries (Myanmar, etc.)
 * - Age verification gate (18+)
 */

// ===== Blocked Countries (ISO 3166-1 alpha-2) =====
// High-risk scam/fraud countries
export const BLOCKED_COUNTRIES: Record<string, string> = {
  MM: "Myanmar",
  // Add more as needed
};

// ===== University/Education IP Ranges =====
// Common patterns for educational institution IPs
const UNIVERSITY_IP_PATTERNS = [
  // Common .edu network ranges (examples)
  /^140\.112\./, // NTU Taiwan
  /^140\.113\./, // NCTU Taiwan
  /^140\.114\./, // NTHU Taiwan
  /^140\.115\./, // NCU Taiwan
  /^140\.116\./, // NCKU Taiwan
  /^140\.117\./, // NSYSU Taiwan
  /^140\.118\./, // NTUST Taiwan
  /^140\.119\./, // NCCU Taiwan
  /^140\.120\./, // NCHU Taiwan
  /^140\.121\./, // NTOU Taiwan
  /^140\.122\./, // NTNU Taiwan
  /^140\.123\./, // CCU Taiwan
  /^140\.124\./, // NKUST Taiwan
  /^140\.125\./, // NKNU Taiwan
  /^140\.126\./, // NCUE Taiwan
  /^140\.127\./, // KMU Taiwan
  /^140\.128\./, // NCUT Taiwan
  /^163\.13\./, // TANet Taiwan
  /^163\.14\./, // TANet Taiwan
  /^163\.15\./, // TANet Taiwan
  /^163\.16\./, // TANet Taiwan
  /^163\.17\./, // TANet Taiwan
  /^163\.18\./, // TANet Taiwan
  /^163\.19\./, // TANet Taiwan
  /^163\.20\./, // TANet Taiwan
  /^163\.21\./, // TANet Taiwan
  /^163\.22\./, // TANet Taiwan
  /^163\.23\./, // TANet Taiwan
  /^163\.24\./, // TANet Taiwan
  /^163\.25\./, // TANet Taiwan
  /^163\.26\./, // TANet Taiwan
  /^163\.27\./, // TANet Taiwan
  /^163\.28\./, // TANet Taiwan
  /^163\.29\./, // TANet Taiwan
  /^163\.30\./, // TANet Taiwan
  /^163\.31\./, // TANet Taiwan
  /^163\.32\./, // TANet Taiwan
  // US universities common ranges
  /^128\./, // Many US universities
  /^129\./, // Many US universities
  /^130\./, // Many US universities
  /^131\./, // Many US universities
  /^132\./, // Many US universities
  /^134\./, // Many US universities
  /^136\./, // Many US universities
  /^137\./, // Many US universities
  /^138\./, // Many US universities
  // HK universities
  /^137\.189\./, // CUHK
  /^147\.8\./, // HKU
  /^158\.132\./, // PolyU
  /^143\.89\./, // HKUST
  /^144\.214\./, // CityU
  // Japan universities
  /^133\./, // SINET Japan
  /^130\.54\./, // Kyoto University
  /^130\.69\./, // University of Tokyo
];

// Additional blocked keywords in reverse DNS
const EDU_DNS_PATTERNS = [
  /\.edu$/i,
  /\.edu\./i,
  /\.ac\.jp$/i,
  /\.ac\.uk$/i,
  /\.ac\.kr$/i,
  /\.edu\.tw$/i,
  /\.edu\.hk$/i,
  /\.edu\.cn$/i,
  /\.edu\.au$/i,
  /university/i,
  /college/i,
  /school/i,
];

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  category?: "country_blocked" | "university_blocked" | "age_restricted";
}

/**
 * Check if an IP address belongs to a university/educational institution
 */
export function isUniversityIP(ip: string): boolean {
  if (!ip) return false;
  return UNIVERSITY_IP_PATTERNS.some(pattern => pattern.test(ip));
}

/**
 * Check if a country code is blocked
 */
export function isBlockedCountry(countryCode: string): boolean {
  if (!countryCode) return false;
  return countryCode.toUpperCase() in BLOCKED_COUNTRIES;
}

/**
 * Main access control check
 */
export function checkAccess(ip: string, countryCode?: string): AccessCheckResult {
  // Check university IP
  if (isUniversityIP(ip)) {
    return {
      allowed: false,
      reason: "Access from educational institution networks is restricted to protect academic integrity.",
      category: "university_blocked",
    };
  }

  // Check blocked countries
  if (countryCode && isBlockedCountry(countryCode)) {
    const countryName = BLOCKED_COUNTRIES[countryCode.toUpperCase()] || countryCode;
    return {
      allowed: false,
      reason: `Access from ${countryName} is currently restricted due to security concerns.`,
      category: "country_blocked",
    };
  }

  return { allowed: true };
}

/**
 * Get the client IP from request headers
 */
export function getClientIP(headers: Record<string, string | string[] | undefined>): string {
  // Check common proxy headers
  const forwardedFor = headers["x-forwarded-for"];
  if (forwardedFor) {
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(",")[0];
    return ip.trim();
  }
  
  const realIP = headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  const cfIP = headers["cf-connecting-ip"];
  if (cfIP) {
    return Array.isArray(cfIP) ? cfIP[0] : cfIP;
  }

  return "unknown";
}

/**
 * Get country code from IP using free GeoIP service
 * Falls back gracefully if service is unavailable
 */
export async function getCountryFromIP(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null; // Skip local/private IPs
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    if (response.ok) {
      const data = await response.json();
      return data.countryCode || null;
    }
  } catch {
    // Silently fail - don't block users if GeoIP service is down
  }
  return null;
}

/**
 * Get access denied page HTML
 */
export function getAccessDeniedMessage(reason: string, category: string): string {
  return `🚫 Access Denied / 訪問被拒絕

${reason}

---

If you believe this is an error, please contact the platform administrator.
如果您認為這是錯誤，請聯繫平台管理員。

Category: ${category}`;
}
