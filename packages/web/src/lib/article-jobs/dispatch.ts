import type { ArticleJobIntakeDispatchSummary } from "./job-intake";

type FetchFn = typeof fetch;

export interface ArticleJobsGitHubEnv {
  [key: string]: string | null | undefined;
  GITHUB_TOKEN?: string | null;
  GITHUB_REPO_OWNER?: string | null;
  GITHUB_REPO_NAME?: string | null;
  GH_PAT?: string | null;
  GH_REPO?: string | null;
}

export interface ArticleJobsGitHubConfig {
  token: string | null | undefined;
  owner: string | null | undefined;
  repo: string | null | undefined;
}

export interface DispatchArticleJobsInput {
  eventType: string;
  jobIds: string[];
  github: ArticleJobsGitHubConfig;
  timeoutMs?: number;
  fetchFn?: FetchFn;
}

export function resolveArticleJobsGitHubConfig(
  env: ArticleJobsGitHubEnv,
): ArticleJobsGitHubConfig {
  if (env.GITHUB_TOKEN && env.GITHUB_REPO_OWNER && env.GITHUB_REPO_NAME) {
    return {
      token: env.GITHUB_TOKEN,
      owner: env.GITHUB_REPO_OWNER,
      repo: env.GITHUB_REPO_NAME,
    };
  }

  const legacyRepo = env.GH_REPO?.split("/");
  return {
    token: env.GH_PAT,
    owner: legacyRepo?.[0],
    repo: legacyRepo?.[1],
  };
}

export async function dispatchArticleJobs({
  eventType,
  jobIds,
  github,
  timeoutMs,
  fetchFn = fetch,
}: DispatchArticleJobsInput): Promise<ArticleJobIntakeDispatchSummary> {
  if (!github.token || !github.owner || !github.repo || jobIds.length === 0) {
    return {
      attempted: false,
      status: "skipped",
      message:
        "GitHub dispatch config incomplete; scheduler fallback remains active",
    };
  }

  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await fetchFn(
      `https://api.github.com/repos/${github.owner}/${github.repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${github.token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: eventType,
          client_payload: {
            jobIds,
            jobCount: jobIds.length,
            timestamp: new Date().toISOString(),
          },
        }),
        signal: controller?.signal,
      },
    );

    if (!response.ok) {
      return {
        attempted: true,
        status: "failed",
        message: `GitHub dispatch failed: ${response.status}`,
      };
    }

    return {
      attempted: true,
      status: "triggered",
    };
  } catch (error) {
    return {
      attempted: true,
      status: "failed",
      message:
        error instanceof Error
          ? `GitHub dispatch failed: ${error.message}`
          : "GitHub dispatch failed",
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
