export interface ArticleJobCompetitorAnalysisRunner {
  analyzeCompetitors(competitors: string[]): Promise<{
    allowed: boolean;
    message?: string;
    results?: unknown[];
  }>;
}

export interface ArticleJobReservationReleaser {
  releaseReservation(jobId: string): Promise<boolean>;
}

export interface ArticleJobCompetitorJobRepository {
  updateArticleJobMetadata(
    jobId: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  deleteArticleJob(jobId: string): Promise<void>;
}

export type AttachCompetitorAnalysisResult =
  | {
      success: true;
      metadata: Record<string, unknown>;
    }
  | {
      success: false;
      error: {
        code: "COMPETITOR_QUOTA_EXCEEDED";
        message: string;
      };
    };

export interface AttachCompetitorAnalysisInput {
  jobId: string;
  competitors: string[];
  metadata: Record<string, unknown>;
  searchRouter: ArticleJobCompetitorAnalysisRunner;
  reservationReleaser: ArticleJobReservationReleaser;
  jobRepository: ArticleJobCompetitorJobRepository;
}

export async function attachCompetitorAnalysisToArticleJob({
  jobId,
  competitors,
  metadata,
  searchRouter,
  reservationReleaser,
  jobRepository,
}: AttachCompetitorAnalysisInput): Promise<AttachCompetitorAnalysisResult> {
  if (competitors.length === 0) {
    return {
      success: true,
      metadata,
    };
  }

  const competitorAnalysisResult =
    await searchRouter.analyzeCompetitors(competitors);

  if (!competitorAnalysisResult.allowed) {
    await reservationReleaser.releaseReservation(jobId);
    await jobRepository.deleteArticleJob(jobId);

    return {
      success: false,
      error: {
        code: "COMPETITOR_QUOTA_EXCEEDED",
        message: competitorAnalysisResult.message || "配額不足",
      },
    };
  }

  const nextMetadata = {
    ...metadata,
    competitorAnalysis: competitorAnalysisResult.results || null,
  };

  await jobRepository.updateArticleJobMetadata(jobId, nextMetadata);

  return {
    success: true,
    metadata: nextMetadata,
  };
}
