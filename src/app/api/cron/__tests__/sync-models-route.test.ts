import { beforeEach, describe, expect, it, vi } from "vitest";

const modelSyncService = vi.hoisted(() => ({
  syncAllProviders: vi.fn(),
  markDeprecatedModels: vi.fn(),
  ModelSyncService: vi.fn(),
}));

vi.mock("@/lib/model-sync/model-sync-service", () => ({
  ModelSyncService: modelSyncService.ModelSyncService,
}));

function request(token: string) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
  };
}

describe("sync models cron route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      OPENAI_API_KEY: "openai-key",
    };
    delete process.env.CRON_SECRET;
    modelSyncService.ModelSyncService.mockImplementation(function () {
      return {
        syncAllProviders: modelSyncService.syncAllProviders,
        markDeprecatedModels: modelSyncService.markDeprecatedModels,
      };
    });
  });

  it("uses the standard cron response when the secret is missing", async () => {
    const { GET } = await import("../sync-models/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("uses the standard cron response when the token is wrong", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { GET } = await import("../sync-models/route");

    const response = await GET(request("wrong") as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("syncs models when the cron token is valid", async () => {
    process.env.CRON_SECRET = "cron-secret";
    modelSyncService.syncAllProviders.mockResolvedValue([
      {
        newModels: 2,
        updatedModels: 3,
        errors: ["minor"],
      },
    ]);
    modelSyncService.markDeprecatedModels.mockResolvedValue(1);
    const { GET } = await import("../sync-models/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      summary: {
        newModels: 2,
        updatedModels: 3,
        deprecatedModels: 1,
        errors: 1,
      },
    });
    expect(modelSyncService.ModelSyncService).toHaveBeenCalledWith(
      "https://supabase.test",
      "service-role",
      "openai-key",
    );
  });
});
