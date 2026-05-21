import { beforeEach, describe, expect, it, vi } from "vitest";

async function post(body: unknown, headers?: HeadersInit) {
  const { POST } = await import("../route");
  return POST(
    new Request(
      "https://1wayseo.com/api/shopline/webhooks/gdpr-customer-redact",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
    ),
  );
}

describe("POST /api/shopline/webhooks/gdpr-customer-redact", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("SHOPLINE_CLIENT_SECRET", "shopline-client-secret");
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("returns 401 when the HMAC header is missing", async () => {
    const response = await post({});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_hmac",
    });
  });

  it("returns 401 when the HMAC header is invalid", async () => {
    const response = await post(
      { shop_id: "shop-1", shop_domain: "demo.myshopline.com" },
      { "X-SHOPLINE-Hmac-Sha256": "invalid-signature" },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_hmac",
    });
  });
});
