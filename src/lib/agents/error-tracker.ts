export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  AI_API = 'ai_api',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  LOGIC = 'logic',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  agentName: string;
  attemptNumber: number;
  maxAttempts: number;
  input?: unknown;
  executionTimeMs?: number;
  timestamp: string;
  articleJobId?: string;
  userId?: string;
  companyId?: string;
}

export interface TrackedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  metadata?: Record<string, unknown>;
}

interface ErrorStats {
  totalErrors: number;
  byCategory: Partial<Record<ErrorCategory, number>>;
  bySeverity: Partial<Record<ErrorSeverity, number>>;
  byAgent: Record<string, number>;
  successRate: Record<string, number>;
}

export interface ErrorTrackerOptions {
  enableLogging: boolean;
  enableMetrics: boolean;
  enableExternalTracking: boolean;
  maxErrorsInMemory: number;
}

export class ErrorTracker {
  private errors: TrackedError[] = [];
  private errorCounts: Map<string, number> = new Map();

  constructor(private options: ErrorTrackerOptions) {}

  trackError(
    agentName: string,
    error: unknown,
    attemptNumber: number,
    maxAttempts: number,
    additionalContext?: Record<string, unknown>
  ): void {
    const err = error as Error & { code?: string };

    const category = this.categorizeError(err);
    const severity = this.determineSeverity(category, attemptNumber, maxAttempts);

    const trackedError: TrackedError = {
      id: this.generateErrorId(),
      category,
      severity,
      message: err.message,
      stack: err.stack,
      context: {
        agentName,
        attemptNumber,
        maxAttempts,
        timestamp: new Date().toISOString(),
        ...additionalContext
      },
      metadata: {
        errorCode: err.code,
        errorName: err.name
      }
    };

    this.addToMemory(trackedError);

    if (this.options.enableLogging) {
      this.logError(trackedError);
    }

    if (this.options.enableMetrics) {
      this.updateMetrics(trackedError);
    }

    if (this.options.enableExternalTracking) {
      this.sendToExternalTracker(trackedError);
    }
  }

  trackSuccess(agentName: string, attemptNumber: number): void {
    if (this.options.enableMetrics) {
      const key = `${agentName}:success`;
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }

    if (attemptNumber > 1 && this.options.enableLogging) {
      console.log(`[ErrorTracker] ✅ ${agentName} succeeded after ${attemptNumber} attempts`);
    }
  }

  trackFallback(reason: string, error: unknown): void {
    const err = error as Error;

    console.error('[ErrorTracker] 🔄 Falling back to legacy system', {
      reason,
      error: err.message
    });

    if (this.options.enableExternalTracking) {
      this.sendToExternalTracker({
        id: this.generateErrorId(),
        category: ErrorCategory.LOGIC,
        severity: ErrorSeverity.CRITICAL,
        message: `Fallback triggered: ${reason}`,
        stack: err.stack,
        context: {
          agentName: 'Orchestrator',
          attemptNumber: 1,
          maxAttempts: 1,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  getStats(): ErrorStats {
    const stats: ErrorStats = {
      totalErrors: this.errors.length,
      byCategory: {},
      bySeverity: {},
      byAgent: {},
      successRate: {}
    };

    this.errors.forEach(err => {
      stats.byCategory[err.category] = (stats.byCategory[err.category] || 0) + 1;
      stats.bySeverity[err.severity] = (stats.bySeverity[err.severity] || 0) + 1;

      const agent = err.context.agentName;
      stats.byAgent[agent] = (stats.byAgent[agent] || 0) + 1;
    });

    this.errorCounts.forEach((count, key) => {
      if (key.endsWith(':success')) {
        const agentName = key.replace(':success', '');
        const errorKey = `${agentName}:error`;
        const errorCount = this.errorCounts.get(errorKey) || 0;
        const successCount = count;
        const total = successCount + errorCount;

        stats.successRate[agentName] = total > 0 ? (successCount / total) * 100 : 100;
      }
    });

    return stats;
  }

  reset(): void {
    this.errors = [];
    this.errorCounts.clear();
  }

  private categorizeError(error: Error & { code?: string }): ErrorCategory {
    const message = error.message.toLowerCase();
    const code = error.code?.toLowerCase();

    if (code === 'etimedout' || message.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (code === 'econnreset' || message.includes('econnreset')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('rate_limit') || message.includes('rate limit')) {
      return ErrorCategory.RATE_LIMIT;
    }
    if (message.includes('parse') || message.includes('json')) {
      return ErrorCategory.PARSING;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('model') || message.includes('api')) {
      return ErrorCategory.AI_API;
    }

    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(
    category: ErrorCategory,
    attemptNumber: number,
    maxAttempts: number
  ): ErrorSeverity {
    if (attemptNumber === maxAttempts) {
      return ErrorSeverity.ERROR;
    }

    if (category === ErrorCategory.RATE_LIMIT || category === ErrorCategory.NETWORK) {
      return ErrorSeverity.WARNING;
    }

    if (category === ErrorCategory.TIMEOUT) {
      return ErrorSeverity.WARNING;
    }

    if (attemptNumber === 1) {
      return ErrorSeverity.INFO;
    }

    return ErrorSeverity.WARNING;
  }

  private logError(error: TrackedError): void {
    const logData = {
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      agent: error.context.agentName,
      attempt: `${error.context.attemptNumber}/${error.context.maxAttempts}`,
      message: error.message
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        console.error('[ErrorTracker]', logData);
        break;
      case ErrorSeverity.WARNING:
        console.warn('[ErrorTracker]', logData);
        break;
      case ErrorSeverity.INFO:
        console.log('[ErrorTracker]', logData);
        break;
    }
  }

  private updateMetrics(error: TrackedError): void {
    const key = `${error.context.agentName}:error`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  private sendToExternalTracker(_error: TrackedError): void {
  }

  private addToMemory(error: TrackedError): void {
    this.errors.push(error);

    if (this.errors.length > this.options.maxErrorsInMemory) {
      this.errors.shift();
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
