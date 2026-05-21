import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@shared/supabase";
import { createAuditLeadUnsubscribeToken } from "@/lib/email/audit-lead-unsubscribe";

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(),
}));

function createFakeSupabase() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    calls,
    from(table: string) {
      const builder = {
        update(...args: unknown[]) {
          calls.push({ table, method: "update", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        single: vi.fn(async () => ({ data: { id: "lead-1" }, error: null })),
      };
      return builder;
    },
  };
}

describe("public audit lead email unsubscribe route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("OAUTH_STATE_SECRET", "oauth-secret");
  });

  it("returns 400 for an invalid token", async () => {
    const supabase = createFakeSupabase();
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/public/audit/lead-email/unsubscribe?token=bad-token",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Invalid unsubscribe token");
    expect(supabase.calls).toEqual([]);
  });

  it("sets nurture_stage=-1 and returns success HTML for a valid token", async () => {
    const supabase = createFakeSupabase();
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const token = createAuditLeadUnsubscribeToken("lead-1");
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        `https://1wayseo.com/api/public/audit/lead-email/unsubscribe?token=${token}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("您已成功取消訂閱");
    expect(supabase.calls).toContainEqual({
      table: "audit_lead_inquiries",
      method: "update",
      args: [{ nurture_stage: -1 }],
    });
    expect(supabase.calls).toContainEqual({
      table: "audit_lead_inquiries",
      method: "eq",
      args: ["id", "lead-1"],
    });
  });
});
