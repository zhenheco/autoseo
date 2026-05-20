import { describe, expect, it } from "vitest";
import { createArticleJobQuotaGateway } from "./quota";

describe("createArticleJobQuotaGateway", () => {
  it("maps successful reservations to reserved status", async () => {
    const gateway = createArticleJobQuotaGateway({
      reserveArticles: async () => ({
        success: true,
        reservationId: "reservation-1",
        availableArticles: 9,
        totalReserved: 1,
      }),
      releaseReservation: async () => true,
    });

    await expect(
      gateway.reserveArticle({
        companyId: "company-1",
        jobId: "job-1",
      }),
    ).resolves.toEqual({
      success: true,
      reservationId: "reservation-1",
      availableArticles: 9,
      totalReserved: 1,
      status: "reserved",
    });
  });

  it("maps quota shortage to insufficient_quota", async () => {
    const gateway = createArticleJobQuotaGateway({
      reserveArticles: async () => ({
        success: false,
        reservationId: null,
        availableArticles: 0,
        totalReserved: 0,
        message: "額度不足",
      }),
      releaseReservation: async () => true,
    });

    await expect(
      gateway.reserveArticle({
        companyId: "company-1",
        jobId: "job-1",
      }),
    ).resolves.toEqual({
      success: false,
      reason: "insufficient_quota",
      availableArticles: 0,
      totalReserved: 0,
      message: "額度不足",
      status: "failed",
    });
  });

  it("maps thrown reservation errors to quota_reservation_failed", async () => {
    const gateway = createArticleJobQuotaGateway({
      reserveArticles: async () => {
        throw new Error("database unavailable");
      },
      releaseReservation: async () => true,
    });

    await expect(
      gateway.reserveArticle({
        companyId: "company-1",
        jobId: "job-1",
      }),
    ).resolves.toEqual({
      success: false,
      reason: "quota_reservation_failed",
      availableArticles: 0,
      totalReserved: 0,
      message: "database unavailable",
      status: "failed",
    });
  });

  it("releases reservations by job id", async () => {
    const gateway = createArticleJobQuotaGateway({
      reserveArticles: async () => {
        throw new Error("not used");
      },
      releaseReservation: async (jobId) => jobId === "job-1",
    });

    await expect(gateway.releaseArticle("job-1")).resolves.toBe(true);
  });

  it("returns false when release throws", async () => {
    const gateway = createArticleJobQuotaGateway({
      reserveArticles: async () => {
        throw new Error("not used");
      },
      releaseReservation: async () => {
        throw new Error("release failed");
      },
    });

    await expect(gateway.releaseArticle("job-1")).resolves.toBe(false);
  });
});
