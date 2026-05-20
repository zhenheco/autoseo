import { beforeEach, describe, expect, it, vi } from "vitest";

describe("payment result redirect JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  });

  it("redirects even when JSON callback body is malformed", async () => {
    const { POST } = await import("../result-redirect/route");

    const response = await POST({
      nextUrl: new URL("https://example.com/api/payment/result-redirect"),
      headers: new Headers({ "content-type": "application/json" }),
      json: vi.fn().mockRejectedValue(new SyntaxError("bad json")),
      formData: vi.fn(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/payment/result",
    );
  });
});
