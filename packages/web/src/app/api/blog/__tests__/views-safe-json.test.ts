import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseClient = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => supabaseClient),
}));

describe("blog views JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["empty", undefined],
    ["malformed", "{"],
  ])("returns 400 for %s body", async (_name, body) => {
    const { POST } = await import("../views/route");

    const response = await POST(
      new Request("https://example.com/api/blog/views", {
        method: "POST",
        body,
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
    expect(supabaseClient.from).not.toHaveBeenCalled();
  });
});
