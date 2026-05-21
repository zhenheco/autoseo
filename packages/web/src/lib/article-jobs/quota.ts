import type {
  ArticleJobFailureReason,
  ArticleJobReservationStatus,
} from "./job-intake";

interface ArticleQuotaReservationServiceResult {
  success: boolean;
  reservationId: string | null;
  availableArticles: number;
  totalReserved: number;
  message?: string;
}

interface ArticleQuotaReservationService {
  reserveArticles(
    companyId: string,
    jobId: string,
    count?: number,
  ): Promise<ArticleQuotaReservationServiceResult>;
  releaseReservation(jobId: string): Promise<boolean>;
}

export type ArticleJobQuotaReservationResult =
  | {
      success: true;
      reservationId: string | null;
      availableArticles: number;
      totalReserved: number;
      status: Extract<ArticleJobReservationStatus, "reserved">;
    }
  | {
      success: false;
      reason: Extract<
        ArticleJobFailureReason,
        "insufficient_quota" | "quota_reservation_failed"
      >;
      availableArticles: number;
      totalReserved: number;
      message: string;
      status: Extract<ArticleJobReservationStatus, "failed">;
    };

export interface ArticleJobQuotaGateway {
  reserveArticle(input: {
    companyId: string;
    jobId: string;
  }): Promise<ArticleJobQuotaReservationResult>;
  releaseArticle(jobId: string): Promise<boolean>;
}

export function createArticleJobQuotaGateway(
  service: ArticleQuotaReservationService,
): ArticleJobQuotaGateway {
  return {
    async reserveArticle({ companyId, jobId }) {
      try {
        const result = await service.reserveArticles(companyId, jobId, 1);

        if (result.success) {
          return {
            success: true,
            reservationId: result.reservationId,
            availableArticles: result.availableArticles,
            totalReserved: result.totalReserved,
            status: "reserved",
          };
        }

        const reason =
          result.availableArticles <= 0
            ? "insufficient_quota"
            : "quota_reservation_failed";

        return {
          success: false,
          reason,
          availableArticles: result.availableArticles,
          totalReserved: result.totalReserved,
          message: result.message || "Quota reservation failed",
          status: "failed",
        };
      } catch (error) {
        return {
          success: false,
          reason: "quota_reservation_failed",
          availableArticles: 0,
          totalReserved: 0,
          message:
            error instanceof Error ? error.message : "Quota reservation failed",
          status: "failed",
        };
      }
    },

    async releaseArticle(jobId) {
      try {
        return await service.releaseReservation(jobId);
      } catch {
        return false;
      }
    },
  };
}
