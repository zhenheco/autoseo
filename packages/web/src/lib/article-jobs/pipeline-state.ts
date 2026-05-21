export const ARTICLE_PIPELINE_PHASES = [
  "research",
  "strategy",
  "images",
  "content",
  "meta",
  "html",
  "category",
  "wordpress",
] as const;

export type ArticlePipelinePhase = (typeof ARTICLE_PIPELINE_PHASES)[number];

export type ArticlePipelineCompletedPhase =
  | "research_completed"
  | "strategy_completed"
  | "images_completed"
  | "content_completed"
  | "meta_completed"
  | "html_completed"
  | "category_completed"
  | "wordpress_published";

export type ArticlePipelineAction =
  | {
      action: "start";
      phase: ArticlePipelinePhase;
    }
  | {
      action: "resume";
      completedPhase: ArticlePipelineCompletedPhase;
      phase: ArticlePipelinePhase;
    }
  | {
      action: "return_cached_article";
      articleId: string;
    }
  | {
      action: "stop";
      reason: "cancelled";
    }
  | {
      action: "complete";
      completedPhase: "wordpress_published";
    }
  | {
      action: "fail_terminal";
      reason: "unknown_phase";
      phase: string;
    };

export interface ArticlePipelineJobState {
  id: string;
  status: string;
  generated_article_id?: string | null;
  metadata?: unknown;
}

const NEXT_PHASE_BY_COMPLETED_PHASE: Record<
  ArticlePipelineCompletedPhase,
  ArticlePipelinePhase | null
> = {
  research_completed: "strategy",
  strategy_completed: "images",
  images_completed: "content",
  content_completed: "meta",
  meta_completed: "html",
  html_completed: "category",
  category_completed: "wordpress",
  wordpress_published: null,
};

const RETRYABLE_ERROR_PATTERNS = [
  "timeout",
  "timed out",
  "etimedout",
  "econnreset",
  "rate limit",
  "temporarily unavailable",
  "service unavailable",
  "overloaded",
];

const NON_RETRYABLE_ERROR_PATTERNS = [
  "cannot resume",
  "invalid state",
  "unknown phase",
  "cancelled",
  "unauthorized",
  "forbidden",
];

export function decideArticlePipelineAction({
  job,
}: {
  job: ArticlePipelineJobState;
}): ArticlePipelineAction {
  if (shouldStopAtPipelineCheckpoint(job)) {
    return {
      action: "stop",
      reason: "cancelled",
    };
  }

  const cachedArticleId = getCachedArticleId(job);
  if (cachedArticleId) {
    return {
      action: "return_cached_article",
      articleId: cachedArticleId,
    };
  }

  const currentPhase = getMetadata(job.metadata).current_phase;
  if (!currentPhase) {
    return {
      action: "start",
      phase: "research",
    };
  }

  if (typeof currentPhase !== "string") {
    return {
      action: "fail_terminal",
      reason: "unknown_phase",
      phase: String(currentPhase),
    };
  }

  if (!isCompletedPhase(currentPhase)) {
    return {
      action: "fail_terminal",
      reason: "unknown_phase",
      phase: currentPhase,
    };
  }

  const nextPhase = NEXT_PHASE_BY_COMPLETED_PHASE[currentPhase];

  if (nextPhase === null) {
    return {
      action: "complete",
      completedPhase: "wordpress_published",
    };
  }

  return {
    action: "resume",
    completedPhase: currentPhase,
    phase: nextPhase,
  };
}

export function shouldStopAtPipelineCheckpoint({ status }: { status: string }) {
  return status === "cancelled";
}

export function getNextPipelinePhase(
  completedPhase: string,
): ArticlePipelinePhase | null | undefined {
  if (isCompletedPhase(completedPhase)) {
    return NEXT_PHASE_BY_COMPLETED_PHASE[completedPhase];
  }

  return undefined;
}

export type ArticlePipelineFailureDecision =
  | {
      action: "retry";
      retryCount: number;
      reason: "retryable_error";
    }
  | {
      action: "fail_terminal";
      retryCount: number;
      reason: "non_retryable_error" | "retry_budget_exhausted";
    };

export function decideArticlePipelineFailure({
  error,
  currentRetryCount,
  maxRetries,
}: {
  error: unknown;
  currentRetryCount: number;
  maxRetries: number;
}): ArticlePipelineFailureDecision {
  if (currentRetryCount >= maxRetries) {
    return {
      action: "fail_terminal",
      retryCount: currentRetryCount,
      reason: "retry_budget_exhausted",
    };
  }

  if (!isRetryablePipelineError(error)) {
    return {
      action: "fail_terminal",
      retryCount: currentRetryCount,
      reason: "non_retryable_error",
    };
  }

  return {
    action: "retry",
    retryCount: currentRetryCount + 1,
    reason: "retryable_error",
  };
}

function getCachedArticleId(job: ArticlePipelineJobState) {
  if (job.generated_article_id) {
    return job.generated_article_id;
  }

  const metadata = getMetadata(job.metadata);
  const generatedArticleId = metadata.generated_article_id;
  return typeof generatedArticleId === "string" && generatedArticleId.length > 0
    ? generatedArticleId
    : null;
}

function getMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }

  return {};
}

function isCompletedPhase(
  value: string,
): value is ArticlePipelineCompletedPhase {
  return Object.prototype.hasOwnProperty.call(
    NEXT_PHASE_BY_COMPLETED_PHASE,
    value,
  );
}

function isRetryablePipelineError(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();

  if (
    NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))
  ) {
    return false;
  }

  return RETRYABLE_ERROR_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}
