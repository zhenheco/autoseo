import { describe, expect, it } from "vitest";
import {
  createScheduledPublishResults,
  recordScheduledPublishFailure,
} from "./scheduled-results";

describe("scheduled publish results", () => {
  it("records a permanent failure", () => {
    const results = createScheduledPublishResults();

    recordScheduledPublishFailure(results, {
      articleId: "job-1",
      title: "Title",
      error: "網站已停用",
      wasRetried: false,
    });

    expect(results).toEqual({
      processed: 0,
      published: 0,
      failed: 1,
      retried: 0,
      details: [
        {
          articleId: "job-1",
          title: "Title",
          status: "failed",
          error: "網站已停用",
        },
      ],
    });
  });

  it("records a retried failure", () => {
    const results = createScheduledPublishResults();

    recordScheduledPublishFailure(results, {
      articleId: "job-1",
      title: "Title",
      error: "同步失敗",
      wasRetried: true,
    });

    expect(results.retried).toBe(1);
    expect(results.failed).toBe(0);
    expect(results.details).toEqual([
      {
        articleId: "job-1",
        title: "Title",
        status: "retried",
        error: "同步失敗",
      },
    ]);
  });
});
