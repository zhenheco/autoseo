import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "authenticated",
        user: { id: "user-1" },
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({
              data: { company_id: "company-1" },
              error: null,
            })),
          })),
        },
      }),
  ),
}));

vi.mock("@/lib/admin/promo-code-service", () => ({
  validatePromoCode: vi.fn(),
}));

describe("promo code validation JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for empty body", async () => {
    const { POST } = await import("../validate/route");

    const response = await POST(
      new Request("https://example.com/api/promo-codes/validate", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });
});
