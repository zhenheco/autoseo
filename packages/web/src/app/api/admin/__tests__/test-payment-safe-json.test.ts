import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseClient = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
}));

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(() => supabaseClient),
}));

vi.mock("@/lib/auth-guard", () => ({
  isSuperAdmin: vi.fn(() => true),
}));

describe("admin test payment JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    supabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-1", email: "admin@example.com" } },
      error: null,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 400 for malformed body", async () => {
    const { POST } = await import("../test-payment/route");

    const response = await POST(
      new Request("https://example.com/api/admin/test-payment", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
