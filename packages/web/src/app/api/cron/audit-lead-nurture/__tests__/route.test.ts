import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@shared/supabase";

const sendAuditNurtureEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/cf-email-client", () => ({
  sendAuditNurtureEmail: sendAuditNurtureEmailMock,
}));

type QueryResult = { data?: unknown; error?: unknown };

function request(token?: string) {
  return new Request("https://1wayseo.com/api/cron/audit-lead-nurture", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function createFakeSupabase(options: {
  leadsByStage: Record<number, unknown[]>;
  reportsByUrl?: Record<string, unknown>;
}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const leadQueryStages: number[] = [];

  return {
    calls,
    from(table: string) {
      const query = {
        stage: undefined as number | undefined,
        url: undefined as string | undefined,
      };
      const builder = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          if (args[0] === "nurture_stage" && typeof args[1] === "number") {
            query.stage = args[1];
            leadQueryStages.push(args[1]);
          }
          if (args[0] === "url" && typeof args[1] === "string") {
            query.url = args[1];
          }
          return builder;
        },
        lte(...args: unknown[]) {
          calls.push({ table, method: "lte", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        limit(...args: unknown[]) {
          calls.push({ table, method: "limit", args });
          return builder;
        },
        update(...args: unknown[]) {
          calls.push({ table, method: "update", args });
          return builder;
        },
        single: vi.fn(async () => ({ data: { id: "updated" }, error: null })),
        maybeSingle: vi.fn(async () => ({
          data: query.url ? (options.reportsByUrl?.[query.url] ?? null) : null,
          error: null,
        })),
        then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?: ((value: QueryResult) => TResult1) | null,
          onrejected?: ((reason: unknown) => TResult2) | null,
        ) {
          if (table === "audit_lead_inquiries" && query.stage !== undefined) {
            return Promise.resolve({
              data: options.leadsByStage[query.stage] ?? [],
              error: null,
            }).then(onfulfilled, onrejected);
          }

          return Promise.resolve({ data: [], error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };
      return builder;
    },
    leadQueryStages,
  };
}

describe("audit lead nurture cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T01:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("OAUTH_STATE_SECRET", "oauth-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.1wayseo.com");
    sendAuditNurtureEmailMock.mockResolvedValue({
      ok: true,
      messageId: "email-1",
    });
  });

  it("returns 401 when CRON_SECRET authorization is missing", async () => {
    const { GET } = await import("../route");

    const response = await GET(request() as never);

    expect(response.status).toBe(401);
    expect(sendAuditNurtureEmailMock).not.toHaveBeenCalled();
  });

  it("sends T+3 for stage=1 leads older than 3 days and advances to stage=2", async () => {
    const supabase = createFakeSupabase({
      leadsByStage: {
        1: [
          {
            id: "lead-1",
            email: "lead@example.com",
            url: "https://shop.example/",
            scanned_at: "2026-05-17T00:00:00.000Z",
            nurture_stage: 1,
          },
        ],
        2: [],
      },
      reportsByUrl: {
        "https://shop.example/": {
          health_score: 64,
          raw_payload: {
            issues: [{ ruleId: "title.missing", page: "/" }],
          },
        },
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      failed: 0,
    });
    expect(sendAuditNurtureEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lead@example.com",
        idempotencyKey: "audit-nurture:lead-1:1",
      }),
    );
    expect(
      sendAuditNurtureEmailMock.mock.calls[0][0].template.subject,
    ).toContain("30");
    expect(supabase.calls).toContainEqual({
      table: "audit_lead_inquiries",
      method: "update",
      args: [{ nurture_stage: 2 }],
    });
  });

  it("sends T+7 for stage=2 leads older than 7 days and advances to stage=3", async () => {
    const supabase = createFakeSupabase({
      leadsByStage: {
        1: [],
        2: [
          {
            id: "lead-2",
            email: "lead@example.com",
            url: "https://shop.example/",
            scanned_at: "2026-05-13T00:00:00.000Z",
            nurture_stage: 2,
          },
        ],
      },
      reportsByUrl: {
        "https://shop.example/": {
          health_score: 71,
          raw_payload: {
            issues: [{ ruleId: "image.alt.missing", page: "/" }],
          },
        },
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      failed: 0,
    });
    expect(sendAuditNurtureEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lead@example.com",
        idempotencyKey: "audit-nurture:lead-2:2",
      }),
    );
    expect(sendAuditNurtureEmailMock.mock.calls[0][0].template.text).toContain(
      "預約免費諮詢",
    );
    expect(supabase.calls).toContainEqual({
      table: "audit_lead_inquiries",
      method: "update",
      args: [{ nurture_stage: 3 }],
    });
  });

  it("skips unsubscribed stage=-1 leads", async () => {
    const supabase = createFakeSupabase({
      leadsByStage: {
        1: [],
        2: [],
        [-1]: [
          {
            id: "lead-unsubscribed",
            email: "lead@example.com",
            url: "https://shop.example/",
            scanned_at: "2026-05-10T00:00:00.000Z",
            nurture_stage: -1,
          },
        ],
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: 0,
      sent: 0,
      failed: 0,
    });
    expect(sendAuditNurtureEmailMock).not.toHaveBeenCalled();
    expect(supabase.leadQueryStages).toEqual([1, 2]);
  });
});
