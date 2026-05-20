import { describe, expect, it } from "vitest";
import {
  dispatchArticleJobs,
  resolveArticleJobsGitHubConfig,
} from "../dispatch";

describe("dispatchArticleJobs", () => {
  it("skips dispatch when GitHub config is incomplete", async () => {
    const result = await dispatchArticleJobs({
      eventType: "article-jobs-created",
      jobIds: ["job-1"],
      github: {
        token: null,
        owner: "owner",
        repo: "repo",
      },
      fetchFn: async () => {
        throw new Error("should not fetch");
      },
    });

    expect(result).toEqual({
      attempted: false,
      status: "skipped",
      message:
        "GitHub dispatch config incomplete; scheduler fallback remains active",
    });
  });

  it("returns triggered when GitHub dispatch succeeds", async () => {
    const result = await dispatchArticleJobs({
      eventType: "article-jobs-created",
      jobIds: ["job-1"],
      github: {
        token: "token",
        owner: "owner",
        repo: "repo",
      },
      fetchFn: async (url, init) => {
        expect(url).toBe("https://api.github.com/repos/owner/repo/dispatches");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer token",
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        });
        expect(JSON.parse(String(init?.body))).toMatchObject({
          event_type: "article-jobs-created",
          client_payload: {
            jobIds: ["job-1"],
            jobCount: 1,
          },
        });
        return new Response(null, { status: 204 });
      },
    });

    expect(result).toEqual({
      attempted: true,
      status: "triggered",
    });
  });

  it("returns failed when GitHub dispatch rejects", async () => {
    const result = await dispatchArticleJobs({
      eventType: "article-jobs-created",
      jobIds: ["job-1"],
      github: {
        token: "token",
        owner: "owner",
        repo: "repo",
      },
      fetchFn: async () => new Response("bad", { status: 500 }),
    });

    expect(result).toEqual({
      attempted: true,
      status: "failed",
      message: "GitHub dispatch failed: 500",
    });
  });

  it("passes an abort signal when a timeout is configured", async () => {
    const result = await dispatchArticleJobs({
      eventType: "article-jobs-created",
      jobIds: ["job-1"],
      github: {
        token: "token",
        owner: "owner",
        repo: "repo",
      },
      timeoutMs: 5000,
      fetchFn: async (_url, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return new Response(null, { status: 204 });
      },
    });

    expect(result).toEqual({
      attempted: true,
      status: "triggered",
    });
  });
});

describe("resolveArticleJobsGitHubConfig", () => {
  it("uses the split batch GitHub env vars when present", () => {
    expect(
      resolveArticleJobsGitHubConfig({
        GITHUB_TOKEN: "token",
        GITHUB_REPO_OWNER: "owner",
        GITHUB_REPO_NAME: "repo",
      }),
    ).toEqual({
      token: "token",
      owner: "owner",
      repo: "repo",
    });
  });

  it("uses the legacy owner/repo env var when split vars are absent", () => {
    expect(
      resolveArticleJobsGitHubConfig({
        GH_PAT: "token",
        GH_REPO: "owner/repo",
      }),
    ).toEqual({
      token: "token",
      owner: "owner",
      repo: "repo",
    });
  });

  it("prefers split vars over legacy vars when both are present", () => {
    expect(
      resolveArticleJobsGitHubConfig({
        GITHUB_TOKEN: "new-token",
        GITHUB_REPO_OWNER: "new-owner",
        GITHUB_REPO_NAME: "new-repo",
        GH_PAT: "old-token",
        GH_REPO: "old-owner/old-repo",
      }),
    ).toEqual({
      token: "new-token",
      owner: "new-owner",
      repo: "new-repo",
    });
  });
});
