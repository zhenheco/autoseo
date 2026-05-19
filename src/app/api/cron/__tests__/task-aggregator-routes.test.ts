import { beforeEach, describe, expect, it, vi } from "vitest";

const articleProcessor = vi.hoisted(() => ({
  processPendingJobs: vi.fn(),
}));

vi.mock("@/lib/article-processor", () => ({
  processPendingJobs: articleProcessor.processPendingJobs,
}));

function request(token: string) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
  };
}

function okJson(data: unknown = { ok: true }) {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => data),
  };
}

describe("cron task aggregator routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.test",
    };
    delete process.env.CRON_SECRET;
  });

  it("daily tasks use the standard cron response when the secret is missing", async () => {
    const { GET } = await import("../daily-tasks/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("daily tasks use the standard cron response when the token is wrong", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { GET } = await import("../daily-tasks/route");

    const response = await GET(request("wrong") as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("daily tasks forward the valid cron authorization header downstream", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson())
      .mockResolvedValueOnce(okJson());
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("../daily-tasks/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      results: {
        processScheduledArticles: { status: "completed" },
        syncModels: { status: "completed" },
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://app.test/api/cron/process-scheduled-articles",
      {
        headers: { authorization: "Bearer cron-secret" },
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://app.test/api/cron/sync-models",
      {
        headers: { authorization: "Bearer cron-secret" },
      },
    );
  });

  it("hourly tasks use the standard cron response when the token is wrong", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { GET } = await import("../hourly-tasks/route");

    const response = await GET(request("wrong") as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("hourly tasks preserve scheduled publishing and pending job processing", async () => {
    process.env.CRON_SECRET = "cron-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson({ published: 1 })));
    articleProcessor.processPendingJobs.mockResolvedValue({ processed: 2 });
    const { GET } = await import("../hourly-tasks/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      results: {
        processScheduledArticles: {
          status: "completed",
          details: { published: 1 },
        },
        processPendingJobs: {
          status: "completed",
          details: { processed: 2 },
        },
      },
    });
    expect(articleProcessor.processPendingJobs).toHaveBeenCalledTimes(1);
  });
});
