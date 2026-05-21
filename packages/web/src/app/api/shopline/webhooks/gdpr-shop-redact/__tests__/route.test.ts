import { beforeEach, describe, expect, it, vi } from "vitest";

async function post(body: unknown, headers?: HeadersInit) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://1wayseo.com/api/shopline/webhooks/gdpr-shop-redact", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }),
  );
}

describe("POST /api/shopline/webhooks/gdpr-shop-redact", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("returns 401 when the HMAC header is missing", async () => {
    const response = await post({});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_hmac",
    });
  });
});
