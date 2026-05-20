import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@shared/supabase";

const sendAuditNurtureEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/cf-email-client", () => ({
  sendAuditNurtureEmail: sendAuditNurtureEmailMock,
}));

type ResponseMap = Record<string, { data?: unknown; error?: unknown }>;

function createFakeSupabase(responses: ResponseMap) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

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
        single: vi.fn(async () => {
          const response = responses[`${table}.single`];
          return response ?? { data: null, error: { message: "not found" } };
        }),
        maybeSingle: vi.fn(async () => {
          const response = responses[`${table}.maybeSingle`];
          return response ?? { data: null, error: null };
        }),
      };
      return builder;
    },
  };
}

async function post(body: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://1wayseo.com/api/public/audit/lead-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "203.0.113.10",
        "accept-language": "zh-TW",
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("public audit lead email route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("PUBLIC_AUDIT_IP_HASH_SALT", "audit-salt");
    vi.stubEnv("OAUTH_STATE_SECRET", "oauth-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.1wayseo.com");
    sendAuditNurtureEmailMock.mockResolvedValue({
      ok: true,
      messageId: "email-1",
    });
  });

  it("returns 400 for an invalid email", async () => {
    const supabase = createFakeSupabase({});
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const response = await post({
      reportId: "report-1",
      email: "not-an-email",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_email",
    });
    expect(sendAuditNurtureEmailMock).not.toHaveBeenCalled();
    expect(supabase.calls).toEqual([]);
  });

  it("updates the lead and sends the T+0 nurture email", async () => {
    const supabase = createFakeSupabase({
      "audit_reports.single": {
        data: {
          id: "report-1",
          url: "https://shop.example/",
          health_score: 67,
          raw_payload: {
            issues: [
              { ruleId: "meta.description.missing", page: "/" },
              { ruleId: "image.alt.missing", page: "/products/a" },
            ],
          },
        },
        error: null,
      },
      "audit_lead_inquiries.maybeSingle": {
        data: {
          id: "lead-1",
          url: "https://shop.example/",
          email: null,
          ip_hash: "matching-hash",
          scanned_at: "2026-05-21T00:00:00.000Z",
          nurture_stage: 0,
        },
        error: null,
      },
      "audit_lead_inquiries.single": {
        data: { id: "lead-1" },
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const response = await post({
      reportId: "report-1",
      email: "Lead@Example.com",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(supabase.calls).toContainEqual({
      table: "audit_lead_inquiries",
      method: "update",
      args: [{ email: "lead@example.com", nurture_stage: 1 }],
    });
    expect(sendAuditNurtureEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lead@example.com",
        idempotencyKey: "audit-nurture:lead-1:0",
      }),
    );
    const sendInput = sendAuditNurtureEmailMock.mock.calls[0][0];
    expect(sendInput.template.subject).toContain("67");
    expect(sendInput.template.text).toContain("meta.description.missing");
    expect(sendInput.template.html).toContain("unsubscribe");
  });

  it("returns 404 when the report has no matching latest IP lead", async () => {
    const supabase = createFakeSupabase({
      "audit_reports.single": {
        data: {
          id: "report-1",
          url: "https://shop.example/",
          health_score: 67,
          raw_payload: { issues: [] },
        },
        error: null,
      },
      "audit_lead_inquiries.maybeSingle": {
        data: null,
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const response = await post({
      reportId: "report-1",
      email: "lead@example.com",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "lead_not_found",
    });
    expect(sendAuditNurtureEmailMock).not.toHaveBeenCalled();
  });
});
