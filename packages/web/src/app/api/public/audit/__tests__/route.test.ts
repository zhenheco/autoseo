import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  auditWebsite: vi.fn(),
}));

vi.mock("@audit", () => auditMocks);

async function post(body?: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://1wayseo.com/api/public/audit", {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    }),
  );
}

describe("public audit API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.resetModules();
  });

  it("returns 400 turnstile_invalid when the turnstile token is missing", async () => {
    const response = await post({ url: "https://example.com" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "turnstile_invalid",
    });
    expect(auditMocks.auditWebsite).not.toHaveBeenCalled();
  });

  it("returns 400 turnstile_invalid when turnstile verification fails", async () => {
    const verifyFetch = vi.fn(async () =>
      Response.json({ success: false, "error-codes": ["invalid-input"] }),
    );
    vi.stubGlobal("fetch", verifyFetch);

    const response = await post({
      url: "https://example.com",
      turnstileToken: "bad-token",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "turnstile_invalid",
    });
    expect(verifyFetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("bad-token"),
      }),
    );
    expect(auditMocks.auditWebsite).not.toHaveBeenCalled();
  });
});
