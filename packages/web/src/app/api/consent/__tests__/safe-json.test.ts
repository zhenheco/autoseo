import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

describe("consent JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["empty", undefined],
    ["malformed", "{"],
  ])("returns 400 for %s body", async (_name, body) => {
    const { POST } = await import("../route");
    const { createAdminClient } = await import("@/lib/supabase/admin");

    const response = await POST(
      new Request("https://example.com/api/consent", {
        method: "POST",
        body,
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
