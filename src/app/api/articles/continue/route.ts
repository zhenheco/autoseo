/**
 * 繼續文章生成 API
 * 用於恢復中斷的文章生成任務
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  notFound,
  internalError,
} from "@/lib/api/response-helpers";
import { ParallelOrchestrator } from "@/lib/agents/orchestrator";

export const maxDuration = 300;

export const POST = withAuth(
  async (request: NextRequest, { user, supabase }) => {
    const { articleJobId } = await request.json();

    if (!articleJobId) {
      return validationError("Article job ID is required");
    }

    // 查詢任務（只能繼續自己的任務）
    const { data: job, error: jobError } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("id", articleJobId)
      .eq("user_id", user.id)
      .single();

    if (!job || jobError) {
      return notFound("任務");
    }

    if (job.status === "completed") {
      return successResponse({
        articleJobId,
        message: "Job already completed",
      });
    }

    if (job.status === "failed") {
      return validationError("Job 已失敗，無法繼續");
    }

    const metadata = job.metadata as Record<string, unknown>;
    const orchestrator = new ParallelOrchestrator();

    try {
      await orchestrator.execute({
        articleJobId: job.id,
        companyId: job.company_id,
        websiteId: job.website_id,
        title: (metadata?.title as string) || job.keywords?.[0] || "Untitled",
        targetLanguage: metadata?.targetLanguage as string,
        wordCount:
          typeof metadata?.wordCount === "string"
            ? parseInt(metadata.wordCount)
            : (metadata?.wordCount as number),
        imageCount:
          typeof metadata?.imageCount === "string"
            ? parseInt(metadata.imageCount)
            : (metadata?.imageCount as number),
      });

      return successResponse({
        articleJobId,
        message: "Article generation continued successfully",
      });
    } catch (error) {
      console.error("Article continuation error:", error);
      return internalError("Article generation continuation failed");
    }
  },
);
