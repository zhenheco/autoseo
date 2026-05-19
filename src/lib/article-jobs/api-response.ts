import { NextResponse } from "next/server";
import type { ArticleJobGenerationResult } from "./generation-service";
import type { ArticleJobIntakeResult } from "./job-intake";

export function articleJobIntakeSingleResponse(result: ArticleJobIntakeResult) {
  const createdJob = result.createdJobs[0];
  if (createdJob) {
    return NextResponse.json({
      success: true,
      articleJobId: createdJob.id,
      message: "文章生成任務已建立，將在背景處理中",
    });
  }

  const skippedJob = result.skippedJobs[0];
  if (skippedJob) {
    return NextResponse.json({
      success: true,
      articleJobId: skippedJob.id,
      message: "文章生成任務已存在，正在背景處理中",
    });
  }

  const firstFailure = result.failedItems[0];
  if (firstFailure?.reason === "insufficient_quota") {
    return NextResponse.json(
      {
        error: "Insufficient quota",
        message: firstFailure.message,
        availableArticles: result.quota.availableArticles,
        reservedArticles: result.quota.reservedArticles,
        upgradeUrl: "/dashboard/subscription",
      },
      { status: 402 },
    );
  }

  if (firstFailure?.reason === "competitor_quota_exceeded") {
    return NextResponse.json(
      {
        error: "Quota exceeded",
        message: firstFailure.message,
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error: "Failed to create article job",
      details: firstFailure?.message || "Unknown article job intake failure",
    },
    { status: 500 },
  );
}

export function articleJobGenerationSingleResponse(
  result: ArticleJobGenerationResult,
) {
  if ("createdJobs" in result) {
    return articleJobIntakeSingleResponse(result);
  }

  return NextResponse.json(
    {
      error: result.error.message,
    },
    { status: 402 },
  );
}

export function articleJobGenerationBatchResponse(
  result: ArticleJobGenerationResult,
) {
  if ("createdJobs" in result) {
    return articleJobIntakeBatchResponse(result);
  }

  return NextResponse.json(
    {
      error: result.error.message,
    },
    { status: 402 },
  );
}

export function articleJobIntakeBatchResponse(result: ArticleJobIntakeResult) {
  const newJobIds = result.createdJobs.map((job) => job.id);
  const skippedJobIds = result.skippedJobs.map((job) => job.id);
  const allJobIds = [...newJobIds, ...skippedJobIds];
  const failedItems = result.failedItems.map((item) => item.keyword);
  const allFailed =
    result.failedItems.length > 0 &&
    result.createdJobs.length === 0 &&
    result.skippedJobs.length === 0;

  if (
    allFailed &&
    result.failedItems.every((item) => item.reason === "insufficient_quota")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Insufficient quota",
        message: result.failedItems[0]?.message || "Insufficient quota",
        requiredCredits: result.quota.requiredArticles,
        availableCredits: result.quota.availableArticles,
        reservedCredits: result.quota.reservedArticles,
        failedItems,
      },
      { status: 402 },
    );
  }

  if (allFailed) {
    return NextResponse.json(
      {
        success: false,
        error: "所有文章任務建立失敗",
        failedItems,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: allJobIds.length > 0,
    jobIds: allJobIds,
    newJobs: newJobIds.length,
    skippedJobs: skippedJobIds.length,
    failedJobs: failedItems.length,
    failedItems,
    message:
      newJobIds.length > 0
        ? `已建立 ${newJobIds.length} 個新任務${skippedJobIds.length > 0 ? `，${skippedJobIds.length} 個已在處理中` : ""}`
        : `${skippedJobIds.length} 個任務已在處理中`,
    polling: {
      statusUrl: "/api/articles/status/[jobId]",
      recommendedInterval: 60000,
    },
  });
}
