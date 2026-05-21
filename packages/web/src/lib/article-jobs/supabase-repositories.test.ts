import { describe, expect, it } from "vitest";
import {
  createSupabaseArticleJobRecordRepository,
  createSupabaseArticleJobCompanyRepository,
  createSupabaseArticleJobWebsiteRepository,
  createSupabaseArticleJobSubscriptionRepository,
} from "./supabase-repositories";

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

  const client = {
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
        in(...args: unknown[]) {
          calls.push({ table, method: "in", args });
          return builder;
        },
        limit(...args: unknown[]) {
          calls.push({ table, method: "limit", args });
          return builder;
        },
        insert(...args: unknown[]) {
          calls.push({ table, method: "insert", args });
          return builder;
        },
        update(...args: unknown[]) {
          calls.push({ table, method: "update", args });
          return builder;
        },
        delete() {
          calls.push({ table, method: "delete", args: [] });
          return builder;
        },
        upsert(...args: unknown[]) {
          calls.push({ table, method: "upsert", args });
          return Promise.resolve(responses[`${table}.upsert`] ?? {});
        },
        maybeSingle<T>() {
          calls.push({ table, method: "maybeSingle", args: [] });
          return Promise.resolve(
            (responses[`${table}.maybeSingle`] ?? {}) as {
              data?: T | null;
              error?: { message?: string } | null;
            },
          );
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
        then<TResult1 = FakeResponse, TResult2 = never>(
          onfulfilled?:
            | ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(
            responses[`${table}.list`] ?? responses[`${table}.insert`] ?? {},
          ).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };

  return client;
}

describe("Supabase article job company repository", () => {
  it("finds the active membership company id", async () => {
    const supabase = createFakeSupabase({
      "company_members.maybeSingle": {
        data: { company_id: "company-1" },
        error: null,
      },
    });
    const repository = createSupabaseArticleJobCompanyRepository(supabase);

    await expect(
      repository.findActiveMembershipCompanyId("user-1"),
    ).resolves.toBe("company-1");

    expect(supabase.calls).toEqual([
      { table: "company_members", method: "select", args: ["company_id"] },
      { table: "company_members", method: "eq", args: ["user_id", "user-1"] },
      { table: "company_members", method: "eq", args: ["status", "active"] },
      { table: "company_members", method: "limit", args: [1] },
      { table: "company_members", method: "maybeSingle", args: [] },
    ]);
  });

  it("creates a personal company and returns its id", async () => {
    const supabase = createFakeSupabase({
      "companies.single": {
        data: { id: "company-1" },
        error: null,
      },
    });
    const repository = createSupabaseArticleJobCompanyRepository(supabase);

    await expect(
      repository.createPersonalCompany({
        userId: "user-1",
        name: "user",
        slug: "user-123",
      }),
    ).resolves.toBe("company-1");

    expect(supabase.calls).toContainEqual({
      table: "companies",
      method: "insert",
      args: [
        {
          owner_id: "user-1",
          name: "user",
          slug: "user-123",
        },
      ],
    });
  });

  it("upserts an owner membership", async () => {
    const supabase = createFakeSupabase({
      "company_members.upsert": {
        error: null,
      },
    });
    const repository = createSupabaseArticleJobCompanyRepository(supabase);

    await expect(
      repository.upsertOwnerMembership({
        companyId: "company-1",
        userId: "user-1",
      }),
    ).resolves.toBeUndefined();

    expect(supabase.calls).toContainEqual({
      table: "company_members",
      method: "upsert",
      args: [
        {
          company_id: "company-1",
          user_id: "user-1",
          role: "owner",
          status: "active",
        },
        {
          onConflict: "company_id,user_id",
        },
      ],
    });
  });
});

describe("Supabase article job website repository", () => {
  it("finds the first website id for a company", async () => {
    const supabase = createFakeSupabase({
      "website_configs.maybeSingle": {
        data: { id: "website-1" },
        error: null,
      },
    });
    const repository = createSupabaseArticleJobWebsiteRepository(supabase);

    await expect(repository.findFirstWebsiteId("company-1")).resolves.toBe(
      "website-1",
    );
  });

  it("creates a default website and agent config", async () => {
    const supabase = createFakeSupabase({
      "website_configs.single": {
        data: { id: "website-1" },
        error: null,
      },
      "agent_configs.single": {
        data: { id: "agent-config-1" },
        error: null,
      },
    });
    const repository = createSupabaseArticleJobWebsiteRepository(supabase);

    await expect(repository.createDefaultWebsite("company-1")).resolves.toBe(
      "website-1",
    );
    await expect(
      repository.createDefaultAgentConfig("website-1"),
    ).resolves.toBeUndefined();

    expect(supabase.calls).toContainEqual({
      table: "website_configs",
      method: "insert",
      args: [
        {
          company_id: "company-1",
          website_name: "",
          wordpress_url: "",
        },
      ],
    });
    expect(supabase.calls).toContainEqual({
      table: "agent_configs",
      method: "insert",
      args: [
        expect.objectContaining({
          website_id: "website-1",
          research_model: "deepseek-reasoner",
          simple_processing_model: "deepseek-chat",
          image_model: "fal-ai/qwen-image",
        }),
      ],
    });
  });
});

describe("Supabase article job subscription repository", () => {
  it("finds an active subscription for the resolved billing account", async () => {
    const supabase = createFakeSupabase({
      "company_subscriptions.single": {
        data: {
          id: "subscription-1",
          status: "active",
        },
        error: null,
      },
    });
    const repository = createSupabaseArticleJobSubscriptionRepository(supabase);

    await expect(
      repository.findActiveSubscription("company-1"),
    ).resolves.toEqual({
      id: "subscription-1",
      status: "active",
    });

    expect(supabase.calls).toEqual([
      {
        table: "company_subscriptions",
        method: "select",
        args: ["id, status"],
      },
      {
        table: "company_subscriptions",
        method: "eq",
        args: ["company_id", "company-1"],
      },
      {
        table: "company_subscriptions",
        method: "eq",
        args: ["status", "active"],
      },
      { table: "company_subscriptions", method: "single", args: [] },
    ]);
  });

  it("returns null when no active subscription exists", async () => {
    const supabase = createFakeSupabase({
      "company_subscriptions.single": {
        data: null,
        error: { message: "No rows returned" },
      },
    });
    const repository = createSupabaseArticleJobSubscriptionRepository(supabase);

    await expect(
      repository.findActiveSubscription("company-1"),
    ).resolves.toBeNull();
  });
});

describe("Supabase article job record repository", () => {
  it("finds pending and processing jobs for duplicate checks", async () => {
    const supabase = createFakeSupabase({
      "article_jobs.list": {
        data: [
          {
            id: "job-1",
            status: "pending",
            keywords: ["seo"],
          },
          {
            id: "job-2",
            status: "processing",
            keywords: ["content"],
          },
          {
            id: "job-3",
            status: "completed",
            keywords: ["ignored"],
          },
        ],
        error: null,
      },
    });
    const repository = createSupabaseArticleJobRecordRepository(supabase);

    await expect(
      repository.findPendingOrProcessingJobs("company-1"),
    ).resolves.toEqual([
      {
        id: "job-1",
        status: "pending",
        keywords: ["seo"],
      },
      {
        id: "job-2",
        status: "processing",
        keywords: ["content"],
      },
    ]);

    expect(supabase.calls).toEqual([
      {
        table: "article_jobs",
        method: "select",
        args: ["id, status, keywords"],
      },
      {
        table: "article_jobs",
        method: "eq",
        args: ["company_id", "company-1"],
      },
      {
        table: "article_jobs",
        method: "in",
        args: ["status", ["pending", "processing"]],
      },
    ]);
  });

  it("inserts an article job record", async () => {
    const supabase = createFakeSupabase({
      "article_jobs.insert": {
        error: null,
      },
    });
    const repository = createSupabaseArticleJobRecordRepository(supabase);

    await expect(
      repository.insertArticleJob({
        id: "job-1",
        jobId: "job-1",
        companyId: "company-1",
        websiteId: "website-1",
        brandId: "brand-1",
        userId: "user-1",
        keywords: ["seo"],
        status: "pending",
        metadata: { title: "seo" },
      }),
    ).resolves.toBeUndefined();

    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "insert",
      args: [
        {
          id: "job-1",
          job_id: "job-1",
          company_id: "company-1",
          website_id: "website-1",
          brand_id: "brand-1",
          user_id: "user-1",
          keywords: ["seo"],
          status: "pending",
          metadata: { title: "seo" },
        },
      ],
    });
  });

  it("deletes an article job record", async () => {
    const supabase = createFakeSupabase({
      "article_jobs.list": {
        error: null,
      },
    });
    const repository = createSupabaseArticleJobRecordRepository(supabase);

    await expect(repository.deleteArticleJob("job-1")).resolves.toBeUndefined();

    expect(supabase.calls).toEqual([
      { table: "article_jobs", method: "delete", args: [] },
      { table: "article_jobs", method: "eq", args: ["id", "job-1"] },
    ]);
  });

  it("updates article job metadata", async () => {
    const supabase = createFakeSupabase({
      "article_jobs.list": {
        error: null,
      },
    });
    const repository = createSupabaseArticleJobRecordRepository(supabase);
    const metadata = {
      title: "seo",
      competitorAnalysis: [{ content: "strategy" }],
    };

    await expect(
      repository.updateArticleJobMetadata("job-1", metadata),
    ).resolves.toBeUndefined();

    expect(supabase.calls).toEqual([
      { table: "article_jobs", method: "update", args: [{ metadata }] },
      { table: "article_jobs", method: "eq", args: ["id", "job-1"] },
    ]);
  });
});
