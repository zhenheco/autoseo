import { beforeEach, describe, expect, it, vi } from "vitest";

const addCfEmailSubscriberMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/cf-email-client", () => ({
  addCfEmailSubscriber: addCfEmailSubscriberMock,
}));

async function post(body?: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://1wayseo.com/api/marketing/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

describe("marketing subscribe route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    addCfEmailSubscriberMock.mockResolvedValue({ ok: true });
  });

  it("returns 400 for missing or invalid request JSON", async () => {
    const response = await post();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
    });
    expect(addCfEmailSubscriberMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email", async () => {
    const response = await post({ email: "not-an-email" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_email",
    });
    expect(addCfEmailSubscriberMock).not.toHaveBeenCalled();
  });

  it("adds normalized email to the newsletter list", async () => {
    const response = await post({ email: " Lead@Example.com " });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(addCfEmailSubscriberMock).toHaveBeenCalledWith({
      email: "lead@example.com",
      list: "1wayseo-newsletter",
    });
  });

  it("returns 409 when the email is already subscribed", async () => {
    addCfEmailSubscriberMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: "already_subscribed",
    });

    const response = await post({ email: "lead@example.com" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "already_subscribed",
    });
  });
});
