import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseArticleJobCompanyRepository: vi.fn(() => "company-repo"),
  createSupabaseArticleJobSubscriptionRepository: vi.fn(
    () => "subscription-repo",
  ),
  createSupabaseArticleJobWebsiteRepository: vi.fn(() => "website-repo"),
  createSupabaseArticleJobRecordRepository: vi.fn(() => "record-repo"),
  createArticleJobQuotaGateway: vi.fn(() => "quota-gateway"),
  createSearchRouter: vi.fn(() => "search-router"),
  createArticleJobIntakeService: vi.fn(() => "intake-service"),
  createArticleJobGenerationService: vi.fn(() => "generation-service"),
  dispatchArticleJobs: vi.fn(async () => ({
    attempted: true,
    status: "triggered",
  })),
}));

vi.mock("./supabase-repositories", () => ({
  createSupabaseArticleJobCompanyRepository:
    mocks.createSupabaseArticleJobCompanyRepository,
  createSupabaseArticleJobSubscriptionRepository:
    mocks.createSupabaseArticleJobSubscriptionRepository,
  createSupabaseArticleJobWebsiteRepository:
    mocks.createSupabaseArticleJobWebsiteRepository,
  createSupabaseArticleJobRecordRepository:
    mocks.createSupabaseArticleJobRecordRepository,
}));

vi.mock("./quota", () => ({
  createArticleJobQuotaGateway: mocks.createArticleJobQuotaGateway,
}));

vi.mock("./intake-service", () => ({
  createArticleJobIntakeService: mocks.createArticleJobIntakeService,
}));

vi.mock("@/lib/search/search-router", () => ({
  createSearchRouter: mocks.createSearchRouter,
}));

vi.mock("./generation-service", () => ({
  createArticleJobGenerationService: mocks.createArticleJobGenerationService,
}));

vi.mock("./dispatch", () => ({
  dispatchArticleJobs: mocks.dispatchArticleJobs,
}));

describe("createSupabaseArticleJobGenerationService", () => {
  it("wires repositories, quota gateway, dispatch, and generation service", async () => {
    const { createSupabaseArticleJobGenerationService } = await import(
      "./factory"
    );
    const supabase = { from: vi.fn() };
    const quotaService = {
      reserveArticles: vi.fn(),
      releaseReservation: vi.fn(),
    };

    const service = createSupabaseArticleJobGenerationService({
      supabase,
      quotaService,
      github: {
        token: "token",
        owner: "owner",
        repo: "repo",
      },
      createJobId: () => "job-1",
      dispatchTimeoutMs: 5000,
    });

    expect(service).toBe("generation-service");
    expect(
      mocks.createSupabaseArticleJobCompanyRepository,
    ).toHaveBeenCalledWith(supabase);
    expect(
      mocks.createSupabaseArticleJobSubscriptionRepository,
    ).toHaveBeenCalledWith(supabase);
    expect(
      mocks.createSupabaseArticleJobWebsiteRepository,
    ).toHaveBeenCalledWith(supabase);
    expect(mocks.createSupabaseArticleJobRecordRepository).toHaveBeenCalledWith(
      supabase,
    );
    expect(mocks.createArticleJobQuotaGateway).toHaveBeenCalledWith(
      quotaService,
    );
    expect(mocks.createArticleJobIntakeService).toHaveBeenCalledWith({
      recordRepository: "record-repo",
      quotaGateway: "quota-gateway",
      createCompetitorAnalysisRunner: expect.any(Function),
      createJobId: expect.any(Function),
      dispatchJobs: expect.any(Function),
    });
    expect(mocks.createArticleJobGenerationService).toHaveBeenCalledWith({
      companyRepository: "company-repo",
      subscriptionRepository: "subscription-repo",
      websiteRepository: "website-repo",
      intakeService: "intake-service",
    });

    const intakeOptions = (
      mocks.createArticleJobIntakeService.mock.calls as unknown as Array<
        [
          {
            createCompetitorAnalysisRunner: (companyId: string) => unknown;
            dispatchJobs: (jobIds: string[]) => Promise<unknown>;
          },
        ]
      >
    )[0][0];
    expect(intakeOptions.createCompetitorAnalysisRunner("company-1")).toBe(
      "search-router",
    );
    expect(mocks.createSearchRouter).toHaveBeenCalledWith({
      companyId: "company-1",
      enableCache: true,
    });
    await expect(intakeOptions.dispatchJobs(["job-1"])).resolves.toEqual({
      attempted: true,
      status: "triggered",
    });
    expect(mocks.dispatchArticleJobs).toHaveBeenCalledWith({
      eventType: "article-jobs-created",
      jobIds: ["job-1"],
      github: {
        token: "token",
        owner: "owner",
        repo: "repo",
      },
      timeoutMs: 5000,
    });
  });
});
