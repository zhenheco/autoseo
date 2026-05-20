import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@shared/supabase";

const sendAuditDigestEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/cf-email-client", () => ({
  sendAuditDigestEmail: sendAuditDigestEmailMock,
}));

function request(token?: string) {
  return new Request("https://example.com/api/cron/audit-weekly-digest", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function createFakeSupabase(
  responses: Record<string, { data?: unknown; error?: unknown }>,
  users: Record<
    string,
    { email?: string; user_metadata?: Record<string, unknown> }
  > = {},
) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    calls,
    auth: {
      admin: {
        getUserById: vi.fn((userId: string) =>
          Promise.resolve({
            data: {
              user: users[userId] ? { id: userId, ...users[userId] } : null,
            },
            error: users[userId] ? null : { message: "User not found" },
          }),
        ),
      },
    },
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        gte(...args: unknown[]) {
          calls.push({ table, method: "gte", args });
          return builder;
        },
        not(...args: unknown[]) {
          calls.push({ table, method: "not", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        insert(...args: unknown[]) {
          calls.push({ table, method: "insert", args });
          return Promise.resolve(
            responses[`${table}.insert`] ?? { data: null, error: null },
          );
        },
        then<TResult1 = { data?: unknown; error?: unknown }, TResult2 = never>(
          onfulfilled?:
            | ((value: { data?: unknown; error?: unknown }) => TResult1)
            | null,
          onrejected?: ((reason: unknown) => TResult2) | null,
        ) {
          return Promise.resolve(
            responses[table] ?? { data: [], error: null },
          ).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };
}

describe("audit weekly digest cron route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.1wayseo.com";
    sendAuditDigestEmailMock.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires cron authorization", async () => {
    const { GET } = await import("../route");

    const missingSecret = await GET(request("cron-secret") as never);
    expect(missingSecret.status).toBe(401);

    process.env.CRON_SECRET = "cron-secret";
    const missingHeader = await GET(request() as never);
    expect(missingHeader.status).toBe(401);

    const wrongToken = await GET(request("wrong") as never);
    expect(wrongToken.status).toBe(401);
  });

  it("skips all companies when there are no audit reports in the past 7 days", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const supabase = createFakeSupabase({
      audit_reports: { data: [], error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      processed: 0,
      skipped: 0,
      sent: 0,
      failed: 0,
    });
    expect(supabase.calls).toContainEqual({
      table: "audit_reports",
      method: "select",
      args: [
        "id, company_id, health_score, scanned_at, companies(id, name, owner_id)",
      ],
    });
    expect(
      supabase.calls.some((call) => call.table === "company_members"),
    ).toBe(false);
  });

  it("computes the weekly delta and sends the digest email", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T00:00:00.000Z"));
    process.env.CRON_SECRET = "cron-secret";
    sendAuditDigestEmailMock.mockResolvedValue({
      ok: true,
      messageId: "email-1",
    });
    const supabase = createFakeSupabase(
      {
        audit_reports: {
          data: [
            {
              id: "report-current",
              company_id: "company-1",
              health_score: 82,
              scanned_at: "2026-05-20T10:00:00.000Z",
              companies: {
                id: "company-1",
                name: "Acme SEO",
                owner_id: "owner-1",
              },
            },
            {
              id: "report-previous",
              company_id: "company-1",
              health_score: 74,
              scanned_at: "2026-05-13T10:00:00.000Z",
              companies: {
                id: "company-1",
                name: "Acme SEO",
                owner_id: "owner-1",
              },
            },
          ],
          error: null,
        },
        audit_issues: {
          data: [
            {
              id: "issue-new",
              rule_id: "missing-title",
              page: "/products/a",
              suggested: "Add a unique product title",
              estimated_impact: "high",
              status: "open",
              created_at: "2026-05-20T10:00:00.000Z",
              updated_at: "2026-05-20T10:00:00.000Z",
            },
            {
              id: "issue-resolved",
              rule_id: "missing-alt",
              page: "/products/b",
              suggested: "Add image alt text",
              estimated_impact: "high",
              status: "resolved",
              created_at: "2026-05-10T10:00:00.000Z",
              updated_at: "2026-05-19T10:00:00.000Z",
            },
            {
              id: "issue-top",
              rule_id: "thin-copy",
              page: "/products/c",
              suggested: "Expand the product copy",
              estimated_impact: "high",
              status: "pending-review",
              created_at: "2026-05-10T10:00:00.000Z",
              updated_at: "2026-05-10T10:00:00.000Z",
            },
          ],
          error: null,
        },
      },
      {
        "owner-1": {
          email: "owner@example.com",
          user_metadata: { locale: "en-US" },
        },
      },
    );
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 1,
      skipped: 0,
      sent: 1,
      failed: 0,
      details: [
        {
          companyId: "company-1",
          companyName: "Acme SEO",
          status: "sent",
          newIssues: 1,
          resolvedIssues: 1,
          healthScoreCurrent: 82,
          healthScoreDelta: 8,
        },
      ],
    });
    expect(sendAuditDigestEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        idempotencyKey: "audit-digest:company-1:2026-W21",
      }),
    );
    const sendInput = sendAuditDigestEmailMock.mock.calls[0][0];
    expect(sendInput.template.subject).toContain("Acme SEO");
    expect(sendInput.template.text).toContain("New issues: 1");
    expect(sendInput.template.text).toContain("Resolved issues: 1");
  });
});
