/**
 * CAPTCHA Module - Distorted Text/Number Verification
 * Prevents automated abuse and fraud in F2F verification
 */

import crypto from 'crypto';

export interface CaptchaChallenge {
  challengeId: string;
  imageUrl: string;
  expiresAt: number;
  attempts: number;
}

export interface CaptchaValidationResult {
  success: boolean;
  message: string;
  challengeId?: string;
}

// Store active CAPTCHA challenges (in production, use Redis)
const activeChallenges = new Map<string, { answer: string; expiresAt: number; attempts: number }>();

/**
 * Generate a random distorted text/number for CAPTCHA
 */
function generateCaptchaText(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar-looking chars
  let text = '';
  for (let i = 0; i < 6; i++) {
    text += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return text;
}

/**
 * Create a CAPTCHA challenge
 * In production, this would generate an actual distorted image
 */
export function createCaptchaChallenge(): CaptchaChallenge {
  const challengeId = crypto.randomBytes(16).toString('hex');
  const captchaText = generateCaptchaText();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store the challenge
  activeChallenges.set(challengeId, {
    answer: captchaText,
    expiresAt,
    attempts: 0,
  });

  // In production, generate actual distorted image using:
  // - Canvas API
  // - Sharp library
  // - AWS Rekognition Custom Labels
  // - Third-party CAPTCHA service (hCaptcha, reCAPTCHA)

  // For now, return a mock image URL
  const imageUrl = `data:image/svg+xml;base64,${Buffer.from(
    `<svg width="300" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="100" fill="#f0f0f0"/>
      <text x="150" y="60" font-size="48" font-weight="bold" text-anchor="middle" fill="#333" 
            transform="skewX(-10) rotate(5)" font-family="Arial">${captchaText}</text>
      <circle cx="50" cy="30" r="3" fill="#999"/>
      <circle cx="250" cy="70" r="2" fill="#999"/>
      <line x1="10" y1="50" x2="290" y2="50" stroke="#ddd" stroke-width="1"/>
    </svg>`
  ).toString('base64')}`;

  return {
    challengeId,
    imageUrl,
    expiresAt,
    attempts: 0,
  };
}

/**
 * Validate CAPTCHA response
 */
export function validateCaptcha(
  challengeId: string,
  userResponse: string
): CaptchaValidationResult {
  const challenge = activeChallenges.get(challengeId);

  if (!challenge) {
    return {
      success: false,
      message: 'CAPTCHA challenge not found or expired',
    };
  }

  // Check if challenge has expired
  if (challenge.expiresAt < Date.now()) {
    activeChallenges.delete(challengeId);
    return {
      success: false,
      message: 'CAPTCHA challenge expired',
    };
  }

  // Check attempt limit
  if (challenge.attempts >= 5) {
    activeChallenges.delete(challengeId);
    return {
      success: false,
      message: 'Too many attempts. Please request a new CAPTCHA.',
    };
  }

  // Increment attempts
  challenge.attempts++;

  // Validate response (case-insensitive)
  const isCorrect = userResponse.toUpperCase().trim() === challenge.answer.toUpperCase();

  if (!isCorrect) {
    return {
      success: false,
      message: `Incorrect CAPTCHA. ${5 - challenge.attempts} attempts remaining.`,
    };
  }

  // Success - remove the challenge
  activeChallenges.delete(challengeId);

  return {
    success: true,
    message: 'CAPTCHA validated successfully',
    challengeId,
  };
}

/**
 * Clean up expired challenges
 */
export function cleanupExpiredChallenges(): number {
  let cleaned = 0;
  const now = Date.now();
  const keysToDelete: string[] = [];

  activeChallenges.forEach((challenge, challengeId) => {
    if (challenge.expiresAt < now) {
      keysToDelete.push(challengeId);
      cleaned++;
    }
  });

  keysToDelete.forEach(key => activeChallenges.delete(key));

  return cleaned;
}

/**
 * Get challenge details (for debugging/testing)
 */
export function getChallengeDetails(challengeId: string): { answer: string; attempts: number } | null {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) return null;

  return {
    answer: challenge.answer,
    attempts: challenge.attempts,
  };
}

/**
 * Generate numeric CAPTCHA (alternative to text)
 */
export function generateNumericCaptcha(): { challenge: string; answer: number } {
  const num1 = Math.floor(Math.random() * 100);
  const num2 = Math.floor(Math.random() * 100);
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];

  let answer: number;
  let challenge: string;

  switch (operation) {
    case '+':
      answer = num1 + num2;
      challenge = `${num1} + ${num2} = ?`;
      break;
    case '-':
      answer = num1 - num2;
      challenge = `${num1} - ${num2} = ?`;
      break;
    case '*':
      answer = num1 * num2;
      challenge = `${num1} × ${num2} = ?`;
      break;
    default:
      answer = num1 + num2;
      challenge = `${num1} + ${num2} = ?`;
  }

  return { challenge, answer };
}

/**
 * Create numeric CAPTCHA challenge
 */
export function createNumericCaptchaChallenge(): {
  challengeId: string;
  challenge: string;
  expiresAt: number;
} {
  const challengeId = crypto.randomBytes(16).toString('hex');
  const { challenge, answer } = generateNumericCaptcha();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  activeChallenges.set(challengeId, {
    answer: answer.toString(),
    expiresAt,
    attempts: 0,
  });

  return {
    challengeId,
    challenge,
    expiresAt,
  };
}

/**
 * Periodic cleanup task (should be called every 15 minutes)
 */
export function startCaptchaCleanupTask(): NodeJS.Timer {
  return setInterval(() => {
    const cleaned = cleanupExpiredChallenges();
    if (cleaned > 0) {
      console.log(`[CAPTCHA] Cleaned up ${cleaned} expired challenges`);
    }
  }, 15 * 60 * 1000); // Every 15 minutes
}
