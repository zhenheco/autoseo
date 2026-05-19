import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit: vi.fn(),
  RATE_LIMIT_CONFIGS: {
    AUTH_RESEND: { windowMs: 60_000, maxRequests: 3 },
  },
}));

describe("auth JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    [
      "forgot-password",
      "../forgot-password/route",
      "https://example.com/api/auth/forgot-password",
    ],
    [
      "resend-verification",
      "../resend-verification/route",
      "https://example.com/api/auth/resend-verification",
    ],
  ])("returns 400 for empty %s body", async (_name, routePath, url) => {
    const { POST } = await import(routePath);
    const { createClient } = await import("@/lib/supabase/server");

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
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    [
      "forgot-password",
      "../forgot-password/route",
      "https://example.com/api/auth/forgot-password",
    ],
    [
      "resend-verification",
      "../resend-verification/route",
      "https://example.com/api/auth/resend-verification",
    ],
  ])("returns 400 for malformed %s body", async (_name, routePath, url) => {
    const { POST } = await import(routePath);
    const { createClient } = await import("@/lib/supabase/server");

    const response = await POST(
      new Request(url, {
        method: "POST",
        body: "{",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
