import { describe, expect, it, vi } from "vitest";

import { runAutoGenerateArticles } from "../auto-generate-articles";

function createDeps(
  results: Array<{ brandId: string; created: number; reason?: string }>,
) {
  return {
    scheduler: {
      tickAllBrands: vi.fn(async () => results),
    },
    resolveBrandOwnerEmail: vi.fn(async (brandId: string) => ({
      brandId,
      brandName: `Brand ${brandId}`,
      companyId: `company-${brandId}`,
      ownerEmail: `${brandId}@example.com`,
    })),
    sendQuotaWarningEmail: vi.fn(async () => ({ ok: true })),
    captureCronRun: vi.fn(),
    setOutput: vi.fn(),
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    now: () => new Date("2026-05-21T00:00:00.000Z"),
  };
}

describe("runAutoGenerateArticles", () => {
  it("logs per-brand created counts from tickAllBrands", async () => {
    const deps = createDeps([
      { brandId: "brand-1", created: 2 },
      { brandId: "brand-2", created: 0, reason: "target_met" },
    ]);

    const result = await runAutoGenerateArticles(deps);

    expect(result.totals).toMatchObject({
      created: 2,
      brandsProcessed: 2,
      quotaExceeded: 0,
    });
    expect(deps.logger.log).toHaveBeenCalledWith(
      "[Auto Generate Articles] brand=brand-1 created=2",
    );
    expect(deps.logger.log).toHaveBeenCalledWith(
      "[Auto Generate Articles] brand=brand-2 created=0 reason=target_met",
    );
  });

  it("sends a warning email to the brand owner when quota is exceeded", async () => {
    const deps = createDeps([
      { brandId: "brand-1", created: 0, reason: "quota_exceeded" },
    ]);

    await runAutoGenerateArticles(deps);

    expect(deps.resolveBrandOwnerEmail).toHaveBeenCalledWith("brand-1");
    expect(deps.sendQuotaWarningEmail).toHaveBeenCalledWith({
      brandId: "brand-1",
      brandName: "Brand brand-1",
      companyId: "company-brand-1",
      ownerEmail: "brand-1@example.com",
      runDate: "2026-05-21",
    });
  });

  it("processes each brand result exactly once and emits observability output", async () => {
    const deps = createDeps([
      { brandId: "brand-1", created: 1 },
      { brandId: "brand-2", created: 0, reason: "quota_exceeded" },
      { brandId: "brand-3", created: 3 },
    ]);

    await runAutoGenerateArticles(deps);

    expect(deps.logger.log).toHaveBeenCalledWith(
      "[Auto Generate Articles] brand=brand-1 created=1",
    );
    expect(deps.logger.log).toHaveBeenCalledWith(
      "[Auto Generate Articles] brand=brand-2 created=0 reason=quota_exceeded",
    );
    expect(deps.logger.log).toHaveBeenCalledWith(
      "[Auto Generate Articles] brand=brand-3 created=3",
    );
    expect(deps.resolveBrandOwnerEmail).toHaveBeenCalledTimes(1);
    expect(deps.captureCronRun).toHaveBeenCalledWith({
      count: 4,
      brandsProcessed: 3,
      quotaExceeded: 1,
    });
    expect(deps.setOutput).toHaveBeenCalledWith("count", "4");
    expect(deps.setOutput).toHaveBeenCalledWith("brands_processed", "3");
    expect(deps.setOutput).toHaveBeenCalledWith("quota_exceeded", "1");
  });
});
