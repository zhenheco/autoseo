import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-middleware", () => ({
  withCompany: vi.fn(
    (handler) => (request: Request) =>
      handler(request, {
        companyId: "company-1",
        supabase: {},
      }),
  ),
}));

describe("AI model company preferences JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for empty POST body", async () => {
    const { POST } = await import("../company-preferences/route");

    const response = await POST(
      new Request("https://example.com/api/ai-models/company-preferences", {
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
