import {
  ARTICLE_PIPELINE_PHASES,
  decideArticlePipelineAction,
  decideArticlePipelineFailure,
  getNextPipelinePhase,
  shouldStopAtPipelineCheckpoint,
} from "./pipeline-state";

describe("article pipeline state decisions", () => {
  it("starts from the first phase when no saved state exists", () => {
    expect(
      decideArticlePipelineAction({
        job: {
          id: "job-1",
          status: "pending",
          metadata: {},
        },
      }),
    ).toEqual({
      action: "start",
      phase: "research",
    });
  });

  it.each([
    ["research_completed", "strategy"],
    ["strategy_completed", "images"],
    ["images_completed", "content"],
    ["content_completed", "meta"],
    ["meta_completed", "html"],
    ["html_completed", "category"],
    ["category_completed", "wordpress"],
  ] as const)("resumes after %s at %s", (currentPhase, nextPhase) => {
    expect(
      decideArticlePipelineAction({
        job: {
          id: "job-1",
          status: "processing",
          metadata: { current_phase: currentPhase },
        },
      }),
    ).toEqual({
      action: "resume",
      completedPhase: currentPhase,
      phase: nextPhase,
    });
  });

  it("returns cached output when a saved generated article id exists", () => {
    expect(
      decideArticlePipelineAction({
        job: {
          id: "job-1",
          status: "processing",
          generated_article_id: "article-1",
          metadata: { current_phase: "content_completed" },
        },
      }),
    ).toEqual({
      action: "return_cached_article",
      articleId: "article-1",
    });
  });

  it("also accepts cached article ids stored in metadata", () => {
    expect(
      decideArticlePipelineAction({
        job: {
          id: "job-1",
          status: "processing",
          metadata: { generated_article_id: "article-1" },
        },
      }),
    ).toEqual({
      action: "return_cached_article",
      articleId: "article-1",
    });
  });

  it("stops cancelled jobs at checkpoints", () => {
    expect(shouldStopAtPipelineCheckpoint({ status: "cancelled" })).toBe(true);
    expect(
      decideArticlePipelineAction({
        job: {
          id: "job-1",
          status: "cancelled",
          metadata: { current_phase: "strategy_completed" },
        },
      }),
    ).toEqual({
      action: "stop",
      reason: "cancelled",
    });
  });

  it("fails closed for unknown saved phases", () => {
    expect(
      decideArticlePipelineAction({
        job: {
          id: "job-1",
          status: "processing",
          metadata: { current_phase: "unknown_phase" },
        },
      }),
    ).toEqual({
      action: "fail_terminal",
      reason: "unknown_phase",
      phase: "unknown_phase",
    });
  });

  it("marks wordpress_published as complete", () => {
    expect(
      decideArticlePipelineAction({
        job: {
          id: "job-1",
          status: "processing",
          metadata: { current_phase: "wordpress_published" },
        },
      }),
    ).toEqual({
      action: "complete",
      completedPhase: "wordpress_published",
    });
  });

  it("exposes the full phase order for callers that need phase guards", () => {
    expect(ARTICLE_PIPELINE_PHASES).toEqual([
      "research",
      "strategy",
      "images",
      "content",
      "meta",
      "html",
      "category",
      "wordpress",
    ]);
  });

  it("returns null when asking for the next phase after the terminal marker", () => {
    expect(getNextPipelinePhase("wordpress_published")).toBeNull();
  });

  it("retries retryable failures while attempts remain", () => {
    expect(
      decideArticlePipelineFailure({
        error: new Error("ETIMEDOUT from model provider"),
        currentRetryCount: 1,
        maxRetries: 3,
      }),
    ).toEqual({
      action: "retry",
      retryCount: 2,
      reason: "retryable_error",
    });
  });

  it("fails terminally for non-retryable failures", () => {
    expect(
      decideArticlePipelineFailure({
        error: new Error("Cannot resume from content_completed phase"),
        currentRetryCount: 0,
        maxRetries: 3,
      }),
    ).toEqual({
      action: "fail_terminal",
      retryCount: 0,
      reason: "non_retryable_error",
    });
  });

  it("fails terminally when retry budget is exhausted", () => {
    expect(
      decideArticlePipelineFailure({
        error: new Error("ECONNRESET"),
        currentRetryCount: 3,
        maxRetries: 3,
      }),
    ).toEqual({
      action: "fail_terminal",
      retryCount: 3,
      reason: "retry_budget_exhausted",
    });
  });
});
