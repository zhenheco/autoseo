import { describe, expect, it, vi } from "vitest";
import { attachCompetitorAnalysisToArticleJob } from "./competitor-analysis";

describe("attachCompetitorAnalysisToArticleJob", () => {
  const baseMetadata = {
    mode: "single",
    title: "SEO",
    competitors: ["https://example.com"],
    competitorAnalysis: null,
  };

  it("updates job metadata with allowed competitor analysis results", async () => {
    const updateArticleJobMetadata = vi.fn(async () => {});
    const deleteArticleJob = vi.fn(async () => {});
    const releaseReservation = vi.fn(async () => true);

    const result = await attachCompetitorAnalysisToArticleJob({
      jobId: "job-1",
      competitors: ["https://example.com"],
      metadata: baseMetadata,
      searchRouter: {
        analyzeCompetitors: vi.fn(async () => ({
          allowed: true,
          results: [{ content: "strategy", provider: "perplexity" }],
        })),
      },
      reservationReleaser: {
        releaseReservation,
      },
      jobRepository: {
        updateArticleJobMetadata,
        deleteArticleJob,
      },
    });

    expect(result).toEqual({
      success: true,
      metadata: {
        ...baseMetadata,
        competitorAnalysis: [{ content: "strategy", provider: "perplexity" }],
      },
    });
    expect(updateArticleJobMetadata).toHaveBeenCalledWith("job-1", {
      ...baseMetadata,
      competitorAnalysis: [{ content: "strategy", provider: "perplexity" }],
    });
    expect(releaseReservation).not.toHaveBeenCalled();
    expect(deleteArticleJob).not.toHaveBeenCalled();
  });

  it("releases article reservation and deletes the job when competitor quota is denied", async () => {
    const updateArticleJobMetadata = vi.fn(async () => {});
    const deleteArticleJob = vi.fn(async () => {});
    const releaseReservation = vi.fn(async () => true);

    const result = await attachCompetitorAnalysisToArticleJob({
      jobId: "job-1",
      competitors: ["https://example.com"],
      metadata: baseMetadata,
      searchRouter: {
        analyzeCompetitors: vi.fn(async () => ({
          allowed: false,
          message: "配額不足",
        })),
      },
      reservationReleaser: {
        releaseReservation,
      },
      jobRepository: {
        updateArticleJobMetadata,
        deleteArticleJob,
      },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "COMPETITOR_QUOTA_EXCEEDED",
        message: "配額不足",
      },
    });
    expect(releaseReservation).toHaveBeenCalledWith("job-1");
    expect(deleteArticleJob).toHaveBeenCalledWith("job-1");
    expect(updateArticleJobMetadata).not.toHaveBeenCalled();
  });

  it("skips search work when there are no competitors", async () => {
    const analyzeCompetitors = vi.fn();
    const updateArticleJobMetadata = vi.fn(async () => {});

    const result = await attachCompetitorAnalysisToArticleJob({
      jobId: "job-1",
      competitors: [],
      metadata: baseMetadata,
      searchRouter: {
        analyzeCompetitors,
      },
      reservationReleaser: {
        releaseReservation: vi.fn(async () => true),
      },
      jobRepository: {
        updateArticleJobMetadata,
        deleteArticleJob: vi.fn(async () => {}),
      },
    });

    expect(result).toEqual({
      success: true,
      metadata: baseMetadata,
    });
    expect(analyzeCompetitors).not.toHaveBeenCalled();
    expect(updateArticleJobMetadata).not.toHaveBeenCalled();
  });
});
