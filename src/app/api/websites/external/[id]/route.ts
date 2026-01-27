/**
 * 單個外部網站管理 API
 * 使用 website_configs 表（website_type = 'external'）
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { withAdmin } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  notFound,
  errorResponse,
  HTTP_STATUS,
} from "@/lib/api/response-helpers";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/websites/external/[id]
 * 取得單個外部網站
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  return withAdmin(async (_req, { adminClient }) => {
    const { data, error } = await adminClient
      .from("website_configs")
      .select("*")
      .eq("id", id)
      .eq("website_type", "external")
      .single();

    if (error || !data) {
      return notFound("外部網站");
    }

    return successResponse({ ...data, webhook_secret: "******" });
  })(request);
}

/**
 * PATCH /api/websites/external/[id]
 * 更新外部網站
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  return withAdmin(async (_req, { adminClient }) => {
    const body = await request.json();

    // 建立更新物件，只包含有傳入的欄位
    const updateData = buildUpdateData(body);

    // 驗證 webhook_url 格式
    if (body.webhook_url !== undefined) {
      try {
        new URL(body.webhook_url);
        updateData.webhook_url = body.webhook_url;
      } catch {
        return validationError("webhook_url 格式無效");
      }
    }

    // 重新生成 webhook_secret
    let newSecret: string | undefined;
    if (body.regenerate_secret) {
      newSecret = crypto.randomBytes(32).toString("hex");
      updateData.webhook_secret = newSecret;
    }

    if (Object.keys(updateData).length === 0) {
      return validationError("沒有要更新的欄位");
    }

    const { data, error } = await adminClient
      .from("website_configs")
      .update(updateData)
      .eq("id", id)
      .eq("website_type", "external")
      .select()
      .single();

    if (error || !data) {
      console.error("[ExternalWebsites] 更新失敗:", error);
      return errorResponse("更新失敗", HTTP_STATUS.INTERNAL_ERROR);
    }

    const response: {
      success: boolean;
      data: typeof data;
      new_webhook_secret?: string;
      message?: string;
    } = {
      success: true,
      data: { ...data, webhook_secret: "******" },
    };

    if (newSecret) {
      response.new_webhook_secret = newSecret;
      response.message =
        "webhook_secret 已重新生成。請妥善保存，此後將不會再顯示完整值。";
    }

    return NextResponse.json(response);
  })(request);
}

/**
 * DELETE /api/websites/external/[id]
 * 刪除外部網站
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  return withAdmin(async (_req, { adminClient }) => {
    // 先檢查是否存在且為外部網站
    const { data: existing } = await adminClient
      .from("website_configs")
      .select("id, website_name")
      .eq("id", id)
      .eq("website_type", "external")
      .single();

    if (!existing) {
      return notFound("外部網站");
    }

    // 刪除（相關的 article_sync_logs 會因為 ON DELETE SET NULL 保留）
    const { error } = await adminClient
      .from("website_configs")
      .delete()
      .eq("id", id)
      .eq("website_type", "external");

    if (error) {
      console.error("[ExternalWebsites] 刪除失敗:", error);
      return errorResponse("刪除失敗", HTTP_STATUS.INTERNAL_ERROR);
    }

    return successResponse(null, `已刪除外部網站: ${existing.website_name}`);
  })(request);
}

/**
 * 從請求 body 建立更新資料物件
 */
function buildUpdateData(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  // 基本欄位映射
  const fieldMappings: Record<string, string> = {
    name: "website_name",
    sync_on_publish: "sync_on_publish",
    sync_on_update: "sync_on_update",
    sync_on_unpublish: "sync_on_unpublish",
    sync_translations: "sync_translations",
    sync_languages: "sync_languages",
    is_active: "is_active",
    brand_voice: "brand_voice",
    auto_schedule_enabled: "auto_schedule_enabled",
    schedule_type: "schedule_type",
    schedule_interval_days: "schedule_interval_days",
    daily_article_limit: "daily_article_limit",
    auto_translate_enabled: "auto_translate_enabled",
    auto_translate_languages: "auto_translate_languages",
    industry: "industry",
    region: "region",
    language: "language",
  };

  for (const [bodyKey, dbKey] of Object.entries(fieldMappings)) {
    if (body[bodyKey] !== undefined) {
      updateData[dbKey] = body[bodyKey];
    }
  }

  return updateData;
}
