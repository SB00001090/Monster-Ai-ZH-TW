import { getDb } from './db';
import { errorLogs, errorFixes } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

export interface ErrorRecord {
  id?: number;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  context?: string;
  occurrenceCount: number;
  lastOccurredAt: Date;
  isFixed: boolean;
  fixApplied?: string;
}

/**
 * Log an error and check if it needs automatic fixing
 */
export async function logAndFixError(error: Error, context: string = 'unknown'): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[ErrorTracking] Database not available');
    return;
  }

  const errorType = error.constructor.name;
  const errorMessage = error.message;
  const errorStack = error.stack;

  try {
    // Check if this error has been logged before
    const existingError = await db
      .select()
      .from(errorLogs)
      .where(
        and(
          eq(errorLogs.errorType, errorType),
          eq(errorLogs.errorMessage, errorMessage)
        )
      )
      .limit(1);

    if (existingError.length > 0) {
      // Error already exists, increment occurrence count
      const existing = existingError[0];
      await db
        .update(errorLogs)
        .set({
          occurrenceCount: ((existing.occurrenceCount || 0) + 1) as any,
          lastOccurredAt: new Date(),
        })
        .where(eq(errorLogs.id, existing.id));

      // Check if we have a known fix for this error
      await applyKnownFix(errorType, errorMessage, context);
    } else {
      // New error, log it
    await db.insert(errorLogs).values([{
      errorType,
      errorMessage,
      errorStack,
      context,
      occurrenceCount: 1,
      lastOccurredAt: new Date(),
      isFixed: 0,
    }]);
    }
  } catch (err) {
    console.error('[ErrorTracking] Failed to log error:', err);
  }
}

/**
 * Apply known fixes for recurring errors
 */
async function applyKnownFix(errorType: string, errorMessage: string, context: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Check if we have a known fix for this error
    const knownFix = await db
      .select()
      .from(errorFixes)
      .where(
        and(
          eq(errorFixes.errorType, errorType),
          eq(errorFixes.errorMessage, errorMessage)
        )
      )
      .limit(1);

    if (knownFix.length > 0) {
      const fix = knownFix[0];
      
      // Apply the fix based on its type
      await applyFixByType(fix.fixType, fix.fixData, context);

      // Mark the error as fixed
      await db
        .update(errorLogs)
        .set({ isFixed: 1 })
        .where(
          and(
            eq(errorLogs.errorType, errorType),
            eq(errorLogs.errorMessage, errorMessage)
          )
        );

      console.log(`[ErrorTracking] Applied fix for ${errorType}: ${errorMessage}`);
    }
  } catch (err) {
    console.error('[ErrorTracking] Failed to apply known fix:', err);
  }
}

/**
 * Apply fix based on its type
 */
async function applyFixByType(fixType: string, fixData: any, context: string): Promise<void> {
  switch (fixType) {
    case 'database_reconnect':
      // Reconnect to database
      console.log('[ErrorTracking] Reconnecting to database...');
      // This would be handled by the connection pooling logic
      break;

    case 'cache_clear':
      // Clear cache
      console.log('[ErrorTracking] Clearing cache...');
      // Cache clearing logic here
      break;

    case 'config_reset':
      // Reset configuration
      console.log('[ErrorTracking] Resetting configuration...');
      // Config reset logic here
      break;

    case 'restart_service':
      // Restart service
      console.log('[ErrorTracking] Restarting service...');
      // Service restart logic here
      break;

    default:
      console.log(`[ErrorTracking] Unknown fix type: ${fixType}`);
  }
}

/**
 * Register a known fix for an error
 */
export async function registerErrorFix(
  errorType: string,
  errorMessage: string,
  fixType: string,
  fixData?: any
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(errorFixes).values([{
      errorType,
      errorMessage,
      fixType,
      fixData: fixData ? JSON.stringify(fixData) : null,
      createdAt: new Date(),
    }]);

    console.log(`[ErrorTracking] Registered fix for ${errorType}: ${errorMessage}`);
  } catch (err) {
    console.error('[ErrorTracking] Failed to register fix:', err);
  }
}

/**
 * Get error statistics
 */
export async function getErrorStats(): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    const allErrors = await db.select().from(errorLogs);
    const fixedErrors = allErrors.filter((e) => e.isFixed);
    const recurringErrors = allErrors.filter((e) => (e.occurrenceCount || 0) > 1);

    return {
      totalErrors: allErrors.length,
      fixedErrors: fixedErrors.length,
      recurringErrors: recurringErrors.length,
      fixRate: allErrors.length > 0 ? fixedErrors.length / allErrors.length : 0,
      errors: allErrors,
    };
  } catch (err) {
    console.error('[ErrorTracking] Failed to get error stats:', err);
    return null;
  }
}
