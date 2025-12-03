export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: readonly string[];
  shouldAdjustParams: boolean;
  timeoutMs?: number;
}

export interface AgentRetryConfig extends RetryConfig {
  agentName: string;
  paramAdjustment?: (attempt: number) => Record<string, unknown>;
}

export const RetryConfigs = {
  STRATEGY_AGENT: {
    agentName: "StrategyAgent",
    maxAttempts: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "model_overloaded",
      "Failed to get response from provider",
    ],
    shouldAdjustParams: true,
    paramAdjustment: (attempt: number) => ({
      temperature: Math.min(0.7 + attempt * 0.1, 1.0),
    }),
    timeoutMs: 120000,
  },

  INTRODUCTION_AGENT: {
    agentName: "IntroductionAgent",
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "Failed to get response from provider",
    ],
    shouldAdjustParams: false,
    timeoutMs: 60000,
  },

  SECTION_AGENT: {
    agentName: "SectionAgent",
    maxAttempts: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "fetch failed",
      "network error",
      "socket hang up",
      "EHOSTUNREACH",
      "Failed to get response from provider",
      "model_overloaded",
    ],
    shouldAdjustParams: false,
    timeoutMs: 120000,
  },

  CONCLUSION_AGENT: {
    agentName: "ConclusionAgent",
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "Failed to get response from provider",
    ],
    shouldAdjustParams: false,
    timeoutMs: 60000,
  },

  QA_AGENT: {
    agentName: "QAAgent",
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "Failed to get response from provider",
    ],
    shouldAdjustParams: false,
    timeoutMs: 60000,
  },

  IMAGE_AGENT: {
    agentName: "ImageAgent",
    maxAttempts: 3,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "content_policy_violation",
    ],
    shouldAdjustParams: true,
    paramAdjustment: (attempt: number) => ({
      quality: attempt > 1 ? "medium" : "high",
    }),
    timeoutMs: 180000,
  },

  ASSEMBLER_AGENT: {
    agentName: "ContentAssemblerAgent",
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: [],
    shouldAdjustParams: false,
    timeoutMs: 30000,
  },

  HTML_AGENT: {
    agentName: "HTMLAgent",
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: [],
    shouldAdjustParams: false,
    timeoutMs: 30000,
  },

  META_AGENT: {
    agentName: "MetaAgent",
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "Failed to get response from provider",
    ],
    shouldAdjustParams: false,
    timeoutMs: 60000,
  },

  RESEARCH_AGENT: {
    agentName: "ResearchAgent",
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "Failed to get response from provider",
      "model_overloaded",
    ],
    shouldAdjustParams: false,
    timeoutMs: 120000,
  },

  CATEGORY_AGENT: {
    agentName: "CategoryAgent",
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ["ECONNRESET", "ETIMEDOUT"],
    shouldAdjustParams: false,
    timeoutMs: 60000,
  },
} as const;

export type AgentRetryConfigMap = typeof RetryConfigs;
export type AgentName = keyof AgentRetryConfigMap;
