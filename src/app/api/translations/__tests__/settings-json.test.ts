import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "authenticated",
        user: { id: "user-1", email: "acejou27@gmail.com" },
        supabase: {},
      }),
  ),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

describe("translation settings JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for malformed update-settings JSON", async () => {
    const { PUT } = await import("../settings/route");

    const response = await PUT({
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });
});
