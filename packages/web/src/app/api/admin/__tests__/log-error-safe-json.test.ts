import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(),
}));

describe("admin log-error JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("keeps the existing non-retry response for malformed telemetry body", async () => {
    const { POST } = await import("../log-error/route");
    const { createClient } = await import("@shared/supabase");

    const response = await POST(
      new Request("https://example.com/api/admin/log-error", {
        method: "POST",
        body: "{",
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      received: false,
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
