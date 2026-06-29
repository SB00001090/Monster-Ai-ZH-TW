/**
 * Enhanced F2F Verification with Real Face Recognition
 * Integrates AWS Rekognition for production-grade verification
 */

import { getDb } from "../db";
import { f2fVerifications, f2fVerificationLogs, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  detectFacesInImage,
  performLivenessCheck,
  compareFaces,
  detectFraudIndicators,
  generateFraudRiskReport,
} from "./faceRecognition";

let db: any = null;

async function ensureDb() {
  if (!db) {
    db = await getDb();
  }
  return db;
}

export interface EnhancedVerificationResult {
  success: boolean;
  message: string;
  verificationId?: number;
  livenessScore?: number;
  fraudScore?: number;
  riskLevel?: "low" | "medium" | "high";
  requiresManualReview?: boolean;
}

/**
 * Enhanced face photo submission with real face detection
 */
export async function submitFacePhotoEnhanced(
  userId: number,
  verificationId: number,
  photoUrl: string,
  photoKey: string,
  ipAddress?: string,
  userAgent?: string
): Promise<EnhancedVerificationResult> {
  try {
    const database = await ensureDb();

    // Step 1: Detect faces in the photo
    const faceDetection = await detectFacesInImage(photoUrl);

    if (!faceDetection.success) {
      await logF2FAction(userId, verificationId, "face_detection_failed", ipAddress, userAgent, faceDetection.message);
      return {
        success: false,
        message: faceDetection.message,
        verificationId,
      };
    }

    // Step 2: Update verification with photo
    await database
      .update(f2fVerifications)
      .set({
        facePhotoUrl: photoUrl,
        facePhotoKey: photoKey,
        lastAttemptAt: new Date(),
      })
      .where(and(eq(f2fVerifications.id, verificationId), eq(f2fVerifications.userId, userId)));

    await logF2FAction(userId, verificationId, "face_photo_verified", ipAddress, userAgent);

    return {
      success: true,
      message: "Face photo verified successfully",
      verificationId,
    };
  } catch (error) {
    console.error("Error submitting enhanced face photo:", error);
    return {
      success: false,
      message: "Failed to submit face photo",
    };
  }
}

/**
 * Enhanced liveness check with fraud detection
 */
export async function submitLivenessCheckEnhanced(
  userId: number,
  verificationId: number,
  videoUrl: string,
  videoKey: string,
  facePhotoUrl: string,
  ipAddress?: string,
  userAgent?: string
): Promise<EnhancedVerificationResult> {
  try {
    const database = await ensureDb();

    // Step 1: Perform liveness check
    const livenessResult = await performLivenessCheck(videoUrl);

    if (!livenessResult.success) {
      await logF2FAction(userId, verificationId, "liveness_check_failed", ipAddress, userAgent, livenessResult.message);
      return {
        success: false,
        message: livenessResult.message,
        verificationId,
      };
    }

    // Step 2: Compare faces (photo vs liveness video)
    const faceComparison = await compareFaces(facePhotoUrl, videoUrl);

    if (!faceComparison.success) {
      await logF2FAction(
        userId,
        verificationId,
        "face_comparison_failed",
        ipAddress,
        userAgent,
        `Face similarity: ${(faceComparison.similarity * 100).toFixed(1)}%`
      );
      return {
        success: false,
        message: faceComparison.message,
        verificationId,
      };
    }

    // Step 3: Detect fraud indicators
    const fraudIndicators = await detectFraudIndicators(facePhotoUrl, videoUrl);

    // Step 4: Generate fraud risk report
    const fraudReport = generateFraudRiskReport(
      livenessResult.livenessScore,
      fraudIndicators.fraudRiskScore,
      faceComparison.similarity,
      fraudIndicators.indicators
    );

    // Step 5: Determine verification status
    let verificationStatus: "verified" | "rejected" = "verified";
    let requiresManualReview = false;

    if (fraudReport.riskLevel === "high") {
      verificationStatus = "rejected";
      requiresManualReview = true;
    } else if (fraudReport.riskLevel === "medium") {
      verificationStatus = "verified";
      requiresManualReview = true;
    }

    // Step 6: Update verification record
    await database
      .update(f2fVerifications)
      .set({
        livenessCheckUrl: videoUrl,
        livenessCheckKey: videoKey,
        livenessScore: livenessResult.livenessScore.toString() as any,
        fraudScore: fraudReport.score.toString() as any,
        verificationStatus,
        verifiedAt: verificationStatus === "verified" ? new Date() : null,
        expiresAt:
          verificationStatus === "verified" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
        lastAttemptAt: new Date(),
        verificationNotes: fraudReport.report,
      })
      .where(and(eq(f2fVerifications.id, verificationId), eq(f2fVerifications.userId, userId)));

    // Step 7: Log the action
    await logF2FAction(
      userId,
      verificationId,
      verificationStatus === "verified" ? "verification_completed" : "verification_rejected",
      ipAddress,
      userAgent,
      `Risk Level: ${fraudReport.riskLevel}`
    );

    // Step 8: Update user profile with verification status
    await database
      .update(users)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      success: verificationStatus === "verified",
      message: `Verification ${verificationStatus}${requiresManualReview ? " (manual review required)" : ""}`,
      verificationId,
      livenessScore: livenessResult.livenessScore,
      fraudScore: fraudReport.score,
      riskLevel: fraudReport.riskLevel,
      requiresManualReview,
    };
  } catch (error) {
    console.error("Error submitting enhanced liveness check:", error);
    return {
      success: false,
      message: "Failed to submit liveness check",
    };
  }
}

/**
 * Log F2F verification action
 */
async function logF2FAction(
  userId: number,
  verificationId: number,
  action: string,
  ipAddress?: string,
  userAgent?: string,
  details?: string
): Promise<void> {
  try {
    const database = await ensureDb();
    await database.insert(f2fVerificationLogs).values({
      userId,
      verificationId,
      action,
      ipAddress,
      userAgent,
      details,
    });
  } catch (error) {
    console.error("Error logging F2F action:", error);
  }
}
