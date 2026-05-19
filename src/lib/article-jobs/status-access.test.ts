import { describe, expect, it } from "vitest";
import {
  asSupabaseRepositoryClient,
  type SupabaseRepositoryClient,
} from "./supabase-repositories";
import {
  createSupabaseArticleJobStatusAccessRepository,
  findCompanyScopedArticleJobStatus,
  findVisibleArticleJobStatus,
} from "./status-access";

interface FakeResponse {
  data?: unknown;
  error?: { message: string } | null;
}

function createFakeSupabase(responses: Record<string, FakeResponse>) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  return {
    calls,
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        single<T>() {
          calls.push({ table, method: "single", args: [] });
          return Promise.resolve(
            (responses[`${table}.single`] ?? {}) as {
              data?: T | null;
              error?: { message?: string } | null;
            },
          );
        },
      };

      return builder;
    },
  };
}

function createRepository(supabase: unknown) {
  return createSupabaseArticleJobStatusAccessRepository(
    asSupabaseRepositoryClient(supabase) as SupabaseRepositoryClient,
  );
}

describe("Article job status access", () => {
  it("loads a job scoped to the authenticated user's active company", async () => {
    const supabase = createFakeSupabase({
      "company_members.single": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "article_jobs.single": {
        data: {
          id: "job-1",
          company_id: "company-1",
          status: "pending",
        },
        error: null,
      },
    });
    const repository = createRepository(supabase);

    await expect(
      findCompanyScopedArticleJobStatus({
        repository,
        userId: "user-1",
        jobId: "job-1",
      }),
    ).resolves.toEqual({
      success: true,
      job: {
        id: "job-1",
        company_id: "company-1",
        status: "pending",
      },
    });

    expect(supabase.calls).toEqual([
      { table: "company_members", method: "select", args: ["company_id"] },
      { table: "company_members", method: "eq", args: ["user_id", "user-1"] },
      { table: "company_members", method: "eq", args: ["status", "active"] },
      { table: "company_members", method: "single", args: [] },
      { table: "article_jobs", method: "select", args: ["*"] },
      { table: "article_jobs", method: "eq", args: ["id", "job-1"] },
      {
        table: "article_jobs",
        method: "eq",
        args: ["company_id", "company-1"],
      },
      { table: "article_jobs", method: "single", args: [] },
    ]);
  });

  it("rejects company-scoped access without an active membership", async () => {
    const repository = createRepository(
      createFakeSupabase({
        "company_members.single": {
          data: null,
          error: { message: "No rows returned" },
        },
      }),
    );

    await expect(
      findCompanyScopedArticleJobStatus({
        repository,
        userId: "user-1",
        jobId: "job-1",
      }),
    ).resolves.toEqual({
      success: false,
      reason: "no_active_membership",
    });
  });

  it("allows direct owner access for the status polling route", async () => {
    const supabase = createFakeSupabase({
      "article_jobs.single": {
        data: {
          id: "job-1",
          user_id: "user-1",
          company_id: "company-1",
          status: "processing",
        },
        error: null,
      },
    });
    const repository = createRepository(supabase);

    await expect(
      findVisibleArticleJobStatus({
        repository,
        userId: "user-1",
        jobId: "job-1",
      }),
    ).resolves.toEqual({
      success: true,
      job: {
        id: "job-1",
        user_id: "user-1",
        company_id: "company-1",
        status: "processing",
      },
    });
    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({
        table: "company_members",
      }),
    );
  });

  it("allows active company members to see a job they do not own", async () => {
    const repository = createRepository(
      createFakeSupabase({
        "article_jobs.single": {
          data: {
            id: "job-1",
            user_id: "other-user",
            company_id: "company-1",
            status: "processing",
          },
          error: null,
        },
        "company_members.single": {
          data: {
            company_id: "company-1",
          },
          error: null,
        },
      }),
    );

    await expect(
      findVisibleArticleJobStatus({
        repository,
        userId: "user-1",
        jobId: "job-1",
      }),
    ).resolves.toMatchObject({
      success: true,
      job: {
        id: "job-1",
      },
    });
  });

  it("denies access when neither owner nor active company member matches", async () => {
    const repository = createRepository(
      createFakeSupabase({
        "article_jobs.single": {
          data: {
            id: "job-1",
            user_id: "other-user",
            company_id: "company-1",
            status: "processing",
          },
          error: null,
        },
        "company_members.single": {
          data: {
            company_id: "company-2",
          },
          error: null,
        },
      }),
    );

    await expect(
      findVisibleArticleJobStatus({
        repository,
        userId: "user-1",
        jobId: "job-1",
      }),
    ).resolves.toEqual({
      success: false,
      reason: "access_denied",
    });
  });
});
