import {
  attachCompetitorAnalysisToArticleJob,
  type ArticleJobCompetitorAnalysisRunner,
} from "./competitor-analysis";
import {
  buildArticleJobIntakeResult,
  splitDuplicateArticleJobItems,
  type ArticleJobIntakeDispatchSummary,
  type ArticleJobIntakeItem,
  type ArticleJobIntakeResult,
  type ArticleJobRecordRepository,
} from "./job-intake";
import type { ArticleJobQuotaGateway } from "./quota";

export interface ArticleJobIntakeServiceInput {
  userId: string;
  companyId: string;
  websiteId: string | null;
  brandId: string;
  items: ArticleJobIntakeItem[];
}

export interface ArticleJobIntakeService {
  createJobs(
    input: ArticleJobIntakeServiceInput,
  ): Promise<ArticleJobIntakeResult>;
}

export interface CreateArticleJobIntakeServiceInput {
  recordRepository: ArticleJobRecordRepository;
  quotaGateway: ArticleJobQuotaGateway;
  createCompetitorAnalysisRunner?: (
    companyId: string,
  ) => ArticleJobCompetitorAnalysisRunner;
  dispatchJobs: (jobIds: string[]) => Promise<ArticleJobIntakeDispatchSummary>;
  createJobId: () => string;
}

export function createArticleJobIntakeService({
  recordRepository,
  quotaGateway,
  createCompetitorAnalysisRunner,
  dispatchJobs,
  createJobId,
}: CreateArticleJobIntakeServiceInput): ArticleJobIntakeService {
  return {
    async createJobs({ userId, companyId, websiteId, brandId, items }) {
      const existingJobs =
        await recordRepository.findPendingOrProcessingJobs(companyId);
      const existingJobsByKeyword = new Map(
        existingJobs.flatMap((job) =>
          job.keywords.map((keyword) => [
            keyword,
            {
              id: job.id,
              status: job.status,
            },
          ]),
        ),
      );
      const { newItems, skippedJobs } = splitDuplicateArticleJobItems({
        items,
        existingJobsByKeyword,
      });

      const createdJobs = [];
      const failedItems = [];
      let availableArticles = 0;
      let reservedArticles = 0;

      for (const item of newItems) {
        const jobId = createJobId();

        try {
          await recordRepository.insertArticleJob({
            id: jobId,
            jobId,
            companyId,
            websiteId,
            brandId,
            userId,
            keywords: [item.keyword],
            status: "pending",
            metadata: {
              ...item.metadata,
              brandId,
              brand_id: brandId,
            },
          });
        } catch (error) {
          failedItems.push({
            keyword: item.keyword,
            reason: "job_insert_failed" as const,
            message:
              error instanceof Error
                ? error.message
                : "Failed to create article job",
          });
          continue;
        }

        const reservation = await quotaGateway.reserveArticle({
          companyId,
          jobId,
        });
        availableArticles = reservation.availableArticles;

        if (!reservation.success) {
          await recordRepository.deleteArticleJob(jobId);
          failedItems.push({
            keyword: item.keyword,
            reason: reservation.reason,
            message: reservation.message,
          });
          continue;
        }

        const competitors = Array.isArray(item.metadata.competitors)
          ? item.metadata.competitors.filter(
              (competitor): competitor is string =>
                typeof competitor === "string",
            )
          : [];

        if (competitors.length > 0) {
          const competitorAnalysis = await attachCompetitorAnalysisToArticleJob(
            {
              jobId,
              competitors,
              metadata: item.metadata,
              searchRouter: createCompetitorAnalysisRunner
                ? createCompetitorAnalysisRunner(companyId)
                : {
                    analyzeCompetitors: async () => ({
                      allowed: true,
                      results: undefined,
                    }),
                  },
              reservationReleaser: {
                releaseReservation: quotaGateway.releaseArticle,
              },
              jobRepository: recordRepository,
            },
          );

          if (!competitorAnalysis.success) {
            failedItems.push({
              keyword: item.keyword,
              reason: "competitor_quota_exceeded" as const,
              message: competitorAnalysis.error.message,
            });
            continue;
          }
        }

        reservedArticles += 1;
        createdJobs.push({
          id: jobId,
          keyword: item.keyword,
          title: item.title,
          reservationStatus: reservation.status,
        });
      }

      const runnableJobIds = createdJobs.map((job) => job.id);
      const dispatch =
        runnableJobIds.length > 0
          ? await dispatchJobs(runnableJobIds)
          : ({
              attempted: false,
              status: "not_needed",
            } satisfies ArticleJobIntakeDispatchSummary);

      return buildArticleJobIntakeResult({
        createdJobs,
        skippedJobs,
        failedItems,
        quota: {
          requiredArticles: newItems.length,
          reservedArticles,
          availableArticles,
        },
        dispatch,
      });
    },
  };
}
