import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { ArticleQuotaService } from "@/lib/billing/article-quota-service";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";
import {
  cacheSet,
  isRedisAvailable,
  CACHE_CONFIG,
} from "@/lib/cache/redis-cache";
import { parseJsonRequest } from "@/lib/api/json-request";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { resolveRequestUser } from "@/lib/api/request-user";
import { asSupabaseRepositoryClient } from "@/lib/article-jobs/supabase-repositories";
import { resolveArticleJobsGitHubConfig } from "@/lib/article-jobs/dispatch";
import { normalizeSingleArticleGenerationInput } from "@/lib/article-jobs/job-intake";
import { createSupabaseArticleJobGenerationService } from "@/lib/article-jobs/factory";
import { articleJobGenerationSingleResponse } from "@/lib/article-jobs/api-response";
import { singleArticleGenerationRequestSchema } from "@/lib/article-jobs/request-schema";
import { BrandNotFoundError, QuotaExceededError } from "@/lib/quota/errors";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // 支持新舊兩種參數格式：
    // 舊版：{ keyword, title, mode }
    // 新版：{ industry, region, language, competitors }
    const bodyResult = await parseJsonRequest(
      request,
      singleArticleGenerationRequestSchema,
    );
    if (!bodyResult.success) {
      return requestErrorResponse(bodyResult.error, {
        fieldOrder: ["industry", "region", "language"],
      });
    }

    const userResult = await resolveRequestUser(request);
    if (!userResult.success) {
      return userResult.response;
    }
    const { user } = userResult;

    // 使用 service role client 進行資料庫查詢（避免 RLS 問題）
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Rate limiting 檢查
    const rateLimitResponse = await checkRateLimit(
      `generate:${user.id}`,
      RATE_LIMIT_CONFIGS.ARTICLE_GENERATE,
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const normalizedInput = normalizeSingleArticleGenerationInput(
      bodyResult.data,
    );
    if (!normalizedInput.success) {
      return NextResponse.json(
        { error: normalizedInput.error.message },
        { status: 400 },
      );
    }

    const service = createSupabaseArticleJobGenerationService({
      supabase: asSupabaseRepositoryClient(supabase),
      quotaService: new ArticleQuotaService(supabase),
      github: resolveArticleJobsGitHubConfig(process.env),
      createJobId: uuidv4,
    });
    const result = await service.createArticleJobs({
      user: {
        id: user.id,
        email: user.email,
      },
      input: normalizedInput.data,
      billingPolicy: "fallback_to_user_id",
      websitePolicy: "select_existing_or_none",
    });

    if ("createdJobs" in result && result.createdJobs.length > 0) {
      if (isRedisAvailable()) {
        await cacheSet(
          CACHE_CONFIG.PENDING_ARTICLE_JOBS.prefix,
          true,
          CACHE_CONFIG.PENDING_ARTICLE_JOBS.ttl,
        ).catch((err) => {
          console.warn("[Generate API] KV flag 設置失敗:", err);
        });
      }
    }

    return articleJobGenerationSingleResponse(result);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          resource: error.resource,
          used: error.used,
          cap: error.cap,
          plan: error.plan,
          upgradeUrl: "/dashboard/settings#upgrade",
        },
        { status: 402 },
      );
    }

    if (error instanceof BrandNotFoundError) {
      return NextResponse.json(
        { error: "brand_not_found", brandId: error.brandId ?? null },
        { status: 404 },
      );
    }

    console.error("Generate article error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
