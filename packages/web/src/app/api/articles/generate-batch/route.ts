import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { v4 as uuidv4 } from "uuid";
import { ArticleQuotaService } from "@/lib/billing/article-quota-service";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";
import { parseJsonRequest } from "@/lib/api/json-request";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { resolveRequestUser } from "@/lib/api/request-user";
import { asSupabaseRepositoryClient } from "@/lib/article-jobs/supabase-repositories";
import { resolveArticleJobsGitHubConfig } from "@/lib/article-jobs/dispatch";
import { normalizeBatchArticleGenerationInput } from "@/lib/article-jobs/job-intake";
import { createSupabaseArticleJobGenerationService } from "@/lib/article-jobs/factory";
import { articleJobGenerationBatchResponse } from "@/lib/article-jobs/api-response";
import { batchArticleGenerationRequestSchema } from "@/lib/article-jobs/request-schema";

// Vercel 無伺服器函數最大執行時間（增加以避免 504 超時）
export const maxDuration = 25; // 增加到 25 秒

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await parseJsonRequest(
      request,
      batchArticleGenerationRequestSchema,
    );
    if (!bodyResult.success) {
      return requestErrorResponse(bodyResult.error, {
        fieldOrder: ["items", "keywords"],
      });
    }

    const userResult = await resolveRequestUser(request);
    if (!userResult.success) {
      return userResult.response;
    }
    const { user } = userResult;

    // Rate limiting 檢查
    const rateLimitResponse = await checkRateLimit(
      `generate-batch:${user.id}`,
      RATE_LIMIT_CONFIGS.ARTICLE_GENERATE_BATCH,
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 使用 Admin Client 繞過 RLS 進行公司/成員操作
    const adminClient = createAdminClient();
    const normalizedInput = normalizeBatchArticleGenerationInput(
      bodyResult.data,
    );
    if (!normalizedInput.success) {
      return NextResponse.json(
        { error: normalizedInput.error.message },
        { status: 400 },
      );
    }

    const service = createSupabaseArticleJobGenerationService({
      supabase: asSupabaseRepositoryClient(adminClient),
      quotaService: new ArticleQuotaService(adminClient),
      github: resolveArticleJobsGitHubConfig(process.env),
      createJobId: uuidv4,
      dispatchTimeoutMs: 5000,
    });

    const result = await service.createArticleJobs({
      user: {
        id: user.id,
        email: user.email,
      },
      input: normalizedInput.data,
      billingPolicy: "ensure_personal_company",
      websitePolicy: "ensure_default",
    });

    return articleJobGenerationBatchResponse(result);
  } catch (error) {
    console.error("Batch generate error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
