/**
 * 外部網站管理 API
 * 用於管理文章同步到的外部專案
 * 使用 website_configs 表（website_type = 'external'）
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { withAdmin } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  errorResponse,
  HTTP_STATUS,
} from "@/lib/api/response-helpers";

export const dynamic = "force-dynamic";

// Ace 的公司 ID（目前外部網站都屬於此公司）
const ACE_COMPANY_ID = "1c9c2d1d-3b26-4ab1-971f-98a980fdbce9";

/**
 * 脫敏外部網站資料（隱藏 webhook_secret）
 */
function sanitizeWebsite<T extends { webhook_secret?: string | null }>(
  website: T,
): T {
  return {
    ...website,
    webhook_secret: website.webhook_secret ? "******" : null,
  };
}

/**
 * GET /api/websites/external
 * 取得所有外部網站
 */
export const GET = withAdmin(async (_request, { adminClient }) => {
  const { data, error } = await adminClient
    .from("website_configs")
    .select("*")
    .eq("website_type", "external")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ExternalWebsites] 查詢失敗:", error);
    return errorResponse("查詢失敗", HTTP_STATUS.INTERNAL_ERROR);
  }

  return successResponse(data.map(sanitizeWebsite));
});

/**
 * POST /api/websites/external
 * 建立新的外部網站
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withAdmin(async (_req, { adminClient }) => {
    const body = await request.json();
    const {
      name,
      slug,
      webhook_url,
      sync_on_publish = true,
      sync_on_update = true,
      sync_on_unpublish = true,
      sync_translations = true,
      sync_languages = ["zh-TW", "en-US"],
    } = body;

    // 驗證必填欄位
    if (!name || !slug || !webhook_url) {
      return validationError("name, slug, webhook_url 為必填");
    }

    // 驗證 slug 格式
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return validationError("slug 只能包含小寫字母、數字和連字符");
    }

    // 驗證 webhook_url 格式
    try {
      new URL(webhook_url);
    } catch {
      return validationError("webhook_url 格式無效");
    }

    // 生成隨機的 webhook_secret
    const webhook_secret = crypto.randomBytes(32).toString("hex");

    const { data, error } = await adminClient
      .from("website_configs")
      .insert({
        company_id: ACE_COMPANY_ID,
        website_name: name,
        wordpress_url: `external://${slug}`,
        website_type: "external",
        external_slug: slug,
        webhook_url,
        webhook_secret,
        sync_on_publish,
        sync_on_update,
        sync_on_unpublish,
        sync_translations,
        sync_languages,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorResponse("slug 已存在", HTTP_STATUS.CONFLICT);
      }
      console.error("[ExternalWebsites] 建立失敗:", error);
      return errorResponse("建立失敗", HTTP_STATUS.INTERNAL_ERROR);
    }

    return successResponse(
      { ...data, webhook_secret },
      "建立成功。請妥善保存 webhook_secret，此後將不會再顯示完整值。",
      HTTP_STATUS.CREATED,
    );
  })(request);
}
