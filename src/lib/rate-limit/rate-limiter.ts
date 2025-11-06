/**
 * Rate Limit Manager
 * 管理 API 請求的速率限制，防止超過配額
 */

export interface RateLimitConfig {
  tokensPerMinute: number;
  requestsPerMinute: number;
  tokensPerDay?: number;
}

export interface RateLimitState {
  tokensUsedThisMinute: number;
  requestsThisMinute: number;
  tokensUsedToday: number;
  minuteResetTime: number;
  dayResetTime: number;
}

export class RateLimiter {
  private state: RateLimitState;
  private config: RateLimitConfig;
  private queue: Array<() => void> = [];
  private processing = false;

  constructor(config: RateLimitConfig) {
    this.config = config;
    const now = Date.now();
    this.state = {
      tokensUsedThisMinute: 0,
      requestsThisMinute: 0,
      tokensUsedToday: 0,
      minuteResetTime: now + 60000,
      dayResetTime: now + 86400000,
    };
  }

  private resetIfNeeded(): void {
    const now = Date.now();

    if (now >= this.state.minuteResetTime) {
      this.state.tokensUsedThisMinute = 0;
      this.state.requestsThisMinute = 0;
      this.state.minuteResetTime = now + 60000;
    }

    if (now >= this.state.dayResetTime) {
      this.state.tokensUsedToday = 0;
      this.state.dayResetTime = now + 86400000;
    }
  }

  async acquire(estimatedTokens: number): Promise<void> {
    return new Promise((resolve) => {
      const attempt = () => {
        this.resetIfNeeded();

        const willExceedTokensPerMinute =
          this.state.tokensUsedThisMinute + estimatedTokens > this.config.tokensPerMinute;

        const willExceedRequestsPerMinute =
          this.state.requestsThisMinute + 1 > this.config.requestsPerMinute;

        const willExceedTokensPerDay =
          this.config.tokensPerDay &&
          this.state.tokensUsedToday + estimatedTokens > this.config.tokensPerDay;

        if (willExceedTokensPerMinute || willExceedRequestsPerMinute || willExceedTokensPerDay) {
          const waitTime = willExceedTokensPerDay
            ? this.state.dayResetTime - Date.now()
            : this.state.minuteResetTime - Date.now();

          console.log(
            `[RateLimiter] Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`
          );
          console.log(`[RateLimiter] Current: ${this.state.tokensUsedThisMinute}/${this.config.tokensPerMinute} TPM, ${this.state.requestsThisMinute}/${this.config.requestsPerMinute} RPM`);

          this.queue.push(attempt);
          this.scheduleProcessing(waitTime);
          return;
        }

        this.state.tokensUsedThisMinute += estimatedTokens;
        this.state.tokensUsedToday += estimatedTokens;
        this.state.requestsThisMinute += 1;

        resolve();
      };

      attempt();
    });
  }

  private scheduleProcessing(delay: number): void {
    if (this.processing) return;

    this.processing = true;
    setTimeout(() => {
      this.processing = false;
      this.processQueue();
    }, delay);
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  reportUsage(actualTokens: number): void {
    const difference = actualTokens - this.state.tokensUsedThisMinute;
    if (difference > 0) {
      this.state.tokensUsedThisMinute += difference;
      this.state.tokensUsedToday += difference;
    }
  }

  getState(): RateLimitState {
    this.resetIfNeeded();
    return { ...this.state };
  }

  getUsagePercentage(): {
    tokensPerMinute: number;
    requestsPerMinute: number;
    tokensPerDay?: number;
  } {
    this.resetIfNeeded();
    return {
      tokensPerMinute: Math.round(
        (this.state.tokensUsedThisMinute / this.config.tokensPerMinute) * 100
      ),
      requestsPerMinute: Math.round(
        (this.state.requestsThisMinute / this.config.requestsPerMinute) * 100
      ),
      tokensPerDay: this.config.tokensPerDay
        ? Math.round((this.state.tokensUsedToday / this.config.tokensPerDay) * 100)
        : undefined,
    };
  }
}

/**
 * Model-specific rate limiters
 */
export const MODEL_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'gpt-5': {
    tokensPerMinute: 2000000,
    requestsPerMinute: 5000,
    tokensPerDay: 100000000,
  },
  'gpt-5-2025-08-07': {
    tokensPerMinute: 2000000,
    requestsPerMinute: 5000,
    tokensPerDay: 100000000,
  },
  'gpt-5-mini': {
    tokensPerMinute: 4000000,
    requestsPerMinute: 5000,
    tokensPerDay: 40000000,
  },
  'gpt-4o': {
    tokensPerMinute: 800000,
    requestsPerMinute: 5000,
    tokensPerDay: 40000000,
  },
  'gpt-4o-mini': {
    tokensPerMinute: 4000000,
    requestsPerMinute: 5000,
    tokensPerDay: 40000000,
  },
  'gpt-image-1-mini': {
    tokensPerMinute: 800000,
    requestsPerMinute: 50,
  },
  'dall-e-3': {
    tokensPerMinute: 500000,
    requestsPerMinute: 5,
  },
  'deepseek-chat': {
    tokensPerMinute: 600000,
    requestsPerMinute: 120,
  },
  'deepseek-reasoner': {
    tokensPerMinute: 60000,
    requestsPerMinute: 60,
  },
  'gemini-2.5-pro': {
    tokensPerMinute: 4000000,
    requestsPerMinute: 1000,
  },
  'gemini-2.5-flash': {
    tokensPerMinute: 4000000,
    requestsPerMinute: 2000,
  },
  'claude-sonnet-4.5': {
    tokensPerMinute: 400000,
    requestsPerMinute: 4000,
  },
  'sonar-pro': {
    tokensPerMinute: 500000,
    requestsPerMinute: 50,
  },
  'sonar-reasoning': {
    tokensPerMinute: 500000,
    requestsPerMinute: 50,
  },
};

const rateLimiters = new Map<string, RateLimiter>();

export function getRateLimiter(model: string): RateLimiter {
  const normalizedModel = model.replace(/^(openai|google|anthropic)\//, '');

  if (!rateLimiters.has(normalizedModel)) {
    const config = MODEL_RATE_LIMITS[normalizedModel];
    if (!config) {
      console.warn(`[RateLimiter] No rate limit config for model: ${normalizedModel}, using default`);
      rateLimiters.set(
        normalizedModel,
        new RateLimiter({
          tokensPerMinute: 100000,
          requestsPerMinute: 60,
        })
      );
    } else {
      rateLimiters.set(normalizedModel, new RateLimiter(config));
    }
  }

  return rateLimiters.get(normalizedModel)!;
}

export function resetAllRateLimiters(): void {
  rateLimiters.clear();
}
