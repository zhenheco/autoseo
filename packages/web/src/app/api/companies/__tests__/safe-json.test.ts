import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseClient = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}));

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(() => supabaseClient),
}));

describe("companies JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    supabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@example.com" } },
      error: null,
    });
  });

  it.each([
    ["empty", undefined],
    ["malformed", "{"],
  ])("returns 400 for %s body", async (_name, body) => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://example.com/api/companies", {
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
