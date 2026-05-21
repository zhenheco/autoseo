export interface ScheduledPublishResultDetail {
  articleId: string;
  title: string | null;
  status: "published" | "failed" | "retried";
  error?: string;
}

export interface ScheduledPublishResults {
  processed: number;
  published: number;
  failed: number;
  retried: number;
  details: ScheduledPublishResultDetail[];
}

export function createScheduledPublishResults(): ScheduledPublishResults {
  return {
    processed: 0,
    published: 0,
    failed: 0,
    retried: 0,
    details: [],
  };
}

export function recordScheduledPublishFailure(
  results: ScheduledPublishResults,
  {
    articleId,
    title,
    error,
    wasRetried,
  }: {
    articleId: string;
    title: string | null;
    error: string;
    wasRetried: boolean;
  },
) {
  if (wasRetried) {
    results.retried++;
    results.details.push({
      articleId,
      title,
      status: "retried",
      error,
    });
    return;
  }

  results.failed++;
  results.details.push({
    articleId,
    title,
    status: "failed",
    error,
  });
}
