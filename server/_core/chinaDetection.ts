/**
 * China IP and Content Detection Module
 * Detects and blocks mainland China IP addresses and related content
 * Allows Hong Kong IPs except Netvigator ISP
 */

import { Request } from 'express';

// China IP ranges (simplified - in production, use MaxMind GeoIP2 or similar)
const CHINA_IP_RANGES = [
  { start: '1.0.0.0', end: '1.0.0.255' },
  { start: '1.0.1.0', end: '1.0.3.255' },
  { start: '1.0.4.0', end: '1.0.5.255' },
  { start: '1.0.8.0', end: '1.0.15.255' },
  // Add more ranges as needed
];

// Hong Kong IP ranges
const HONGKONG_IP_RANGES = [
  { start: '1.160.0.0', end: '1.160.255.255' },
  { start: '1.161.0.0', end: '1.161.255.255' },
  // Add more ranges as needed
];

// Netvigator ISP ASN
const NETVIGATOR_ASN = 'AS9269';

// Chinese political content keywords
const CHINA_POLITICAL_KEYWORDS = [
  '中共',
  '中国共产党',
  '习近平',
  '台独',
  '西藏独立',
  '新疆独立',
  '六四',
  '天安门',
  '法轮功',
  '反共',
];

// Chinese university domain patterns
const CHINA_UNIVERSITY_DOMAINS = [
  '.edu.cn',
  '.ac.cn',
  'tsinghua.edu.cn',
  'peking.edu.cn',
  'fudan.edu.cn',
  'sjtu.edu.cn',
  'zju.edu.cn',
  'whu.edu.cn',
  'xjtu.edu.cn',
  'pku.edu.cn',
];

export interface ChinaDetectionResult {
  isMainlandChina: boolean;
  isHongKong: boolean;
  isNetvigator: boolean;
  hasPoliticalContent: boolean;
  hasUniversityContent: boolean;
  reason?: string;
  shouldBlock: boolean;
}

/**
 * Check if IP is from mainland China
 */
export function isMainlandChinaIP(ip: string): boolean {
  // In production, use MaxMind GeoIP2 or similar service
  // This is a simplified check
  const ipNum = ipToNumber(ip);

  for (const range of CHINA_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }

  return false;
}

/**
 * Check if IP is from Hong Kong
 */
export function isHongKongIP(ip: string): boolean {
  // In production, use MaxMind GeoIP2 or similar service
  const ipNum = ipToNumber(ip);

  for (const range of HONGKONG_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }

  return false;
}

/**
 * Convert IP address to number for range comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  return (
    parseInt(parts[0], 10) * 256 * 256 * 256 +
    parseInt(parts[1], 10) * 256 * 256 +
    parseInt(parts[2], 10) * 256 +
    parseInt(parts[3], 10)
  );
}

/**
 * Check if content contains Chinese political keywords
 */
export function hasPoliticalContent(content: string): boolean {
  const lowerContent = content.toLowerCase();

  for (const keyword of CHINA_POLITICAL_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if content references Chinese university
 */
export function hasUniversityContent(content: string): boolean {
  const lowerContent = content.toLowerCase();

  for (const domain of CHINA_UNIVERSITY_DOMAINS) {
    if (lowerContent.includes(domain)) {
      return true;
    }
  }

  return false;
}

/**
 * Comprehensive China detection check
 */
export function detectChinaAccess(req: Request, userContent?: string): ChinaDetectionResult {
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] as string;

  const result: ChinaDetectionResult = {
    isMainlandChina: isMainlandChinaIP(ipAddress),
    isHongKong: isHongKongIP(ipAddress),
    isNetvigator: userAgent?.includes(NETVIGATOR_ASN) || false,
    hasPoliticalContent: userContent ? hasPoliticalContent(userContent) : false,
    hasUniversityContent: userContent ? hasUniversityContent(userContent) : false,
    shouldBlock: false,
  };

  // Determine if access should be blocked
  if (result.isMainlandChina) {
    result.shouldBlock = true;
    result.reason = 'Mainland China IP detected';
  } else if (result.isHongKong && result.isNetvigator) {
    result.shouldBlock = true;
    result.reason = 'Netvigator ISP (Hong Kong) detected';
  }

  if (result.hasPoliticalContent) {
    result.shouldBlock = true;
    result.reason = 'Chinese political content detected';
  }

  if (result.hasUniversityContent) {
    result.shouldBlock = true;
    result.reason = 'Chinese university content detected';
  }

  return result;
}

/**
 * Get China detection warning message
 */
export function getChinaDetectionMessage(reason?: string): string {
  return `
    ⚠️ Access Denied - Trojan Risk Warning
    
    MonsterAi is not available in mainland China due to security concerns.
    
    ${reason ? `Reason: ${reason}` : ''}
    
    If you are accessing from outside mainland China, please contact support.
    
    此平台在中国大陆不可用。
  `;
}

/**
 * Check if user should be blocked based on China detection
 */
export function shouldBlockChinaUser(req: Request, userContent?: string): {
  blocked: boolean;
  message: string;
  details: ChinaDetectionResult;
} {
  const detection = detectChinaAccess(req, userContent);

  if (detection.shouldBlock) {
    return {
      blocked: true,
      message: getChinaDetectionMessage(detection.reason),
      details: detection,
    };
  }

  return {
    blocked: false,
    message: '',
    details: detection,
  };
}

/**
 * Log China detection events for security audit
 */
export function logChinaDetectionEvent(
  req: Request,
  detection: ChinaDetectionResult,
  userId?: number
): void {
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || '';
  const timestamp = new Date().toISOString();

  console.log(`[CHINA_DETECTION] ${timestamp}`, {
    userId,
    ipAddress,
    detection,
    userAgent: req.headers['user-agent'],
  });

  // In production, store this in a security audit log database
}
