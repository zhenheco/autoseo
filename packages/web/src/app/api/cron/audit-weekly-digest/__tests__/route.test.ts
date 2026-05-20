import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@shared/supabase";

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(),
}));

function request(token?: string) {
  return new Request("https://example.com/api/cron/audit-weekly-digest", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function createFakeSupabase(
  responses: Record<string, { data?: unknown; error?: unknown }>,
) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    calls,
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
});
