/**
 * Self-Healing System for MonsterAi
 * Provides automatic error detection, retry, fallback, and recovery mechanisms.
 */

interface ErrorRecord {
  timestamp: number;
  error: string;
  context: string;
  resolved: boolean;
  resolution?: string;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "critical";
  llmAvailable: boolean;
  dbAvailable: boolean;
  lastCheck: number;
  errorRate: number;
  recentErrors: ErrorRecord[];
}

// In-memory error tracking
const errorLog: ErrorRecord[] = [];
const MAX_ERROR_LOG = 100;
const ERROR_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Log an error for tracking
 */
export function logError(error: string, context: string) {
  errorLog.push({
    timestamp: Date.now(),
    error,
    context,
    resolved: false,
  });
  
  // Keep log bounded
  if (errorLog.length > MAX_ERROR_LOG) {
    errorLog.splice(0, errorLog.length - MAX_ERROR_LOG);
  }
}

/**
 * Mark an error as resolved
 */
export function resolveError(index: number, resolution: string) {
  if (errorLog[index]) {
    errorLog[index].resolved = true;
    errorLog[index].resolution = resolution;
  }
}

/**
 * Get current error rate (errors per minute in last 5 minutes)
 */
export function getErrorRate(): number {
  const now = Date.now();
  const recentErrors = errorLog.filter(e => now - e.timestamp < ERROR_WINDOW_MS);
  return recentErrors.length / 5; // errors per minute
}

/**
 * Get system health status
 */
export function getHealthStatus(): HealthStatus {
  const errorRate = getErrorRate();
  const now = Date.now();
  const recentErrors = errorLog.filter(e => now - e.timestamp < ERROR_WINDOW_MS);
  
  let status: "healthy" | "degraded" | "critical" = "healthy";
  if (errorRate > 5) status = "critical";
  else if (errorRate > 2) status = "degraded";
  
  return {
    status,
    llmAvailable: true, // Will be updated by health checks
    dbAvailable: true,
    lastCheck: now,
    errorRate,
    recentErrors: recentErrors.slice(-10),
  };
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    context?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, context = "unknown" } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // If we recovered from errors, log the resolution
      if (attempt > 0) {
        resolveError(errorLog.length - 1, `Recovered after ${attempt} retries`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      logError(error.message || String(error), context);
      
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitter = delay * 0.1 * Math.random();
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }
  }
  
  throw lastError;
}

/**
 * Execute with fallback strategies
 */
export async function executeWithFallback<T>(
  strategies: Array<{ name: string; fn: () => Promise<T> }>,
  context: string = "unknown"
): Promise<T> {
  let lastError: Error | null = null;
  
  for (const strategy of strategies) {
    try {
      const result = await retryWithBackoff(strategy.fn, {
        maxRetries: 2,
        context: `${context}:${strategy.name}`,
      });
      return result;
    } catch (error: any) {
      lastError = error;
      logError(`Strategy "${strategy.name}" failed: ${error.message}`, context);
    }
  }
  
  throw new Error(`All strategies failed for ${context}: ${lastError?.message}`);
}

/**
 * Circuit breaker pattern
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  
  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open - service temporarily unavailable");
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "open";
    }
  }
  
  getState() {
    return { state: this.state, failures: this.failures };
  }
}

// Global circuit breakers for different services
export const llmCircuitBreaker = new CircuitBreaker(5, 30000);
export const dbCircuitBreaker = new CircuitBreaker(3, 15000);

/**
 * Self-healing wrapper for LLM calls
 */
export async function selfHealingLLMCall<T>(
  primaryFn: () => Promise<T>,
  fallbackFn?: () => Promise<T>,
  context: string = "llm_call"
): Promise<T> {
  const strategies: Array<{ name: string; fn: () => Promise<T> }> = [
    { name: "primary", fn: () => llmCircuitBreaker.execute(primaryFn) },
  ];
  
  if (fallbackFn) {
    strategies.push({ name: "fallback", fn: fallbackFn });
  }
  
  return executeWithFallback(strategies, context);
}

/**
 * Get error statistics for monitoring
 */
export function getErrorStats() {
  const now = Date.now();
  const last5min = errorLog.filter(e => now - e.timestamp < 5 * 60 * 1000);
  const last1hour = errorLog.filter(e => now - e.timestamp < 60 * 60 * 1000);
  
  return {
    total: errorLog.length,
    last5min: last5min.length,
    last1hour: last1hour.length,
    resolved: errorLog.filter(e => e.resolved).length,
    unresolved: errorLog.filter(e => !e.resolved).length,
    errorRate: getErrorRate(),
    health: getHealthStatus(),
    circuitBreakers: {
      llm: llmCircuitBreaker.getState(),
      db: dbCircuitBreaker.getState(),
    },
  };
}
