import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("revalidate JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns the standard invalid JSON response for malformed POST body", async () => {
    process.env.REVALIDATE_SECRET = "secret-1";
    const { POST } = await import("../route");
    const { revalidatePath } = await import("next/cache");

    const response = await POST(
      new Request("https://example.com/api/revalidate", {
        method: "POST",
        body: "{",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
