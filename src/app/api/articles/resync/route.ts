/**
 * 文章重新同步 API
 * 將已發布的文章重新發送 webhook 到外部專案（如 onehand）
 *
 * POST /api/articles/resync
 * - 重新同步所有已發布文章（或指定的文章）
 * - 會發送 article.updated 事件到所有啟用的同步目標
 *
 * 認證方式：
 * 1. Session Cookie（登入用戶）
 * 2. x-resync-secret Header（內部呼叫，需配合 companyId）
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  successResponse,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";
import { syncArticle } from "@/lib/sync";
import type { GeneratedArticle } from "@/types/article.types";

export const dynamic = "force-dynamic";

// 限制每次同步的最大文章數
const MAX_ARTICLES_PER_BATCH = 50;

// 內部 API Secret（從環境變數讀取）
const RESYNC_SECRET = process.env.RESYNC_API_SECRET?.trim();

interface ResyncRequest {
  articleIds?: string[]; // 可選：指定要同步的文章 ID 列表
  syncTargetIds?: string[]; // 可選：指定同步目標 ID 列表
  companyId?: string; // 使用 secret 認證時必須提供
}

/**
 * POST /api/articles/resync
 * 重新同步已發布的文章到外部專案
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 檢查 secret key 認證
    const secretHeader = request.headers.get("x-resync-secret");

    // 如果有提供 secret，驗證它
    if (secretHeader) {
      if (!RESYNC_SECRET) {
        console.error("[Resync] RESYNC_API_SECRET 環境變數未設定");
        return internalError("Server configuration error");
      }

      if (secretHeader !== RESYNC_SECRET) {
        return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
      }

      // 使用 admin client（secret 認證通過）
      const supabase = createAdminClient();
      const body = (await request.json()) as ResyncRequest;
      const { articleIds, syncTargetIds, companyId } = body;

      if (!companyId) {
        return validationError("使用 secret 認證時必須提供 companyId");
      }

      return resyncArticles(supabase, companyId, articleIds, syncTargetIds);
    }

    // 沒有 secret，返回需要登入的錯誤
    return NextResponse.json(
      { error: "Authentication required. Use x-resync-secret header or login." },
      { status: 401 }
    );
  } catch (error) {
    console.error("[Resync] 錯誤:", error);
    return internalError(
      error instanceof Error ? error.message : "重新同步失敗"
    );
  }
}

/**
 * 執行文章重新同步
 */
async function resyncArticles(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  articleIds?: string[],
  syncTargetIds?: string[]
): Promise<NextResponse> {
  // 查詢已發布的文章
  let query = supabase
    .from("generated_articles")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(MAX_ARTICLES_PER_BATCH);

  // 如果指定了文章 ID，過濾查詢
  if (articleIds && articleIds.length > 0) {
    query = query.in("id", articleIds);
  }

  const { data: articles, error } = await query;

  if (error) {
    console.error("[Resync] 查詢文章失敗:", error);
    return internalError(`查詢失敗: ${error.message}`);
  }

  if (!articles || articles.length === 0) {
    return validationError("沒有找到已發布的文章");
  }

  // 同步所有文章
  const results = [];
  let successCount = 0;
  let failedCount = 0;

  for (const article of articles) {
    try {
      const result = await syncArticle(
        article as GeneratedArticle,
        "update",
        syncTargetIds
      );

      results.push({
        article_id: article.id,
        title: article.title,
        success: result.success > 0,
        targets_synced: result.success,
        targets_failed: result.failed,
      });

      if (result.success > 0) {
        successCount++;
      } else if (result.failed > 0) {
        failedCount++;
      }
    } catch (err) {
      console.error(`[Resync] 文章 ${article.id} 同步失敗:`, err);
      results.push({
        article_id: article.id,
        title: article.title,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      failedCount++;
    }
  }

  return successResponse({
    total: articles.length,
    success: successCount,
    failed: failedCount,
    results,
  });
}
