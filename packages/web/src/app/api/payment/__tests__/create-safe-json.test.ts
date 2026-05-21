import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "authenticated",
        user: { id: "user-1" },
        supabase: {},
      }),
  ),
}));

vi.mock("@/lib/payment/payment-service", () => ({
  PaymentService: {
    createInstance: vi.fn(),
  },
}));

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

describe("payment create JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    [
      "onetime",
      "../onetime/create/route",
      "https://example.com/api/payment/onetime/create",
    ],
    [
      "recurring",
      "../recurring/create/route",
      "https://example.com/api/payment/recurring/create",
    ],
  ])("returns 400 for empty %s body", async (_name, routePath, url) => {
    const { POST } = await import(routePath);

    const response = await POST(
      new Request(url, {
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
