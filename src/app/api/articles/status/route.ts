import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/api/request-user";
import { createAdminClient } from "@/lib/supabase/server";
import { asSupabaseRepositoryClient } from "@/lib/article-jobs/supabase-repositories";
import {
  createSupabaseArticleJobStatusAccessRepository,
  findVisibleArticleJobStatus,
} from "@/lib/article-jobs/status-access";

function recordValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function metadataValue(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  return metadata?.[key];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    const userResult = await resolveRequestUser(request);
    if (!userResult.success) {
      return userResult.response;
    }
    const { user } = userResult;

    const repository = createSupabaseArticleJobStatusAccessRepository(
      asSupabaseRepositoryClient(createAdminClient()),
    );
    const statusResult = await findVisibleArticleJobStatus({
      repository,
      userId: user.id,
      jobId,
    });

    if (!statusResult.success && statusResult.reason === "not_found") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!statusResult.success) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const { job } = statusResult;
    const metadata = recordValue(job.metadata);
    const result = recordValue(metadataValue(metadata, "result"));
    const meta = recordValue(metadataValue(result, "meta"));
    const metaDescription = metadataValue(meta, "description");

    // 如果任務已完成，返回生成的內容
    if (job.status === "completed") {
      return NextResponse.json({
        status: job.status,
        progress: 100,
        article: {
          title: job.article_title,
          content: job.generated_content,
          meta_description:
            typeof metaDescription === "string" ? metaDescription : undefined,
        },
        fullResult: result, // 完整結果
        metadata,
        completedAt: job.completed_at,
      });
    }

    // 根據狀態計算進度
    let progress = 0;
    let message = "";

    switch (job.status) {
      case "pending":
        progress = 0;
        message = "任務排隊中...";
        break;
      case "processing":
        progress = 50;
        message = "正在生成文章...";
        // 如果有更詳細的進度資訊
        if (typeof metadata?.progress === "number") {
          progress = metadata.progress;
        }
        if (typeof metadata?.currentStep === "string") {
          message = metadata.currentStep;
        }
        break;
      case "completed":
        progress = 100;
        message = "文章生成完成！";
        break;
      case "failed":
        progress = 0;
        message = `生成失敗: ${job.error_message || "未知錯誤"}`;
        break;
    }

    return NextResponse.json({
      status: job.status,
      progress,
      message,
      metadata,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      error: job.error_message,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
