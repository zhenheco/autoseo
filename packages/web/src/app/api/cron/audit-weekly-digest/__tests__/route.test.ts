import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(),
}));

function request(token?: string) {
  return new Request("https://example.com/api/cron/audit-weekly-digest", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
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
});
