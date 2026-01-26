/**
 * 單個外部網站（同步目標）管理 API
 * 現在使用 website_configs 表（website_type = 'external'）
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils/admin-check";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * 驗證管理員權限
 */
async function verifyAdmin(): Promise<{ success: true } | { success: false; response: NextResponse }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      response: NextResponse.json({ success: false, error: "請先登入" }, { status: 401 }),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      success: false,
      response: NextResponse.json({ success: false, error: "無管理員權限" }, { status: 403 }),
    };
  }

  return { success: true };
}

/**
 * GET /api/admin/sync-targets/[id]
 * 取得單個外部網站
 */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;

    const auth = await verifyAdmin();
    if (!auth.success) return auth.response;

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("website_configs")
      .select("*")
      .eq("id", id)
      .eq("website_type", "external")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "找不到同步目標" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { ...data, webhook_secret: "******" },
    });
  } catch (error) {
    console.error("[SyncTargets] GET 錯誤:", error);
    return NextResponse.json({ success: false, error: "伺服器錯誤" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/sync-targets/[id]
 * 更新外部網站
 */
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;

    const auth = await verifyAdmin();
    if (!auth.success) return auth.response;

    const body = await request.json();
    const {
      name,
      webhook_url,
      sync_on_publish,
      sync_on_update,
      sync_on_unpublish,
      sync_translations,
      sync_languages,
      is_active,
      regenerate_secret,
    } = body;

    // 建立更新物件
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.website_name = name;
    if (webhook_url !== undefined) {
      try {
        new URL(webhook_url);
        updateData.webhook_url = webhook_url;
      } catch {
        return NextResponse.json({ success: false, error: "webhook_url 格式無效" }, { status: 400 });
      }
    }
    if (sync_on_publish !== undefined) updateData.sync_on_publish = sync_on_publish;
    if (sync_on_update !== undefined) updateData.sync_on_update = sync_on_update;
    if (sync_on_unpublish !== undefined) updateData.sync_on_unpublish = sync_on_unpublish;
    if (sync_translations !== undefined) updateData.sync_translations = sync_translations;
    if (sync_languages !== undefined) updateData.sync_languages = sync_languages;
    if (is_active !== undefined) updateData.is_active = is_active;

    // 重新生成 webhook_secret
    let newSecret: string | undefined;
    if (regenerate_secret) {
      newSecret = crypto.randomBytes(32).toString("hex");
      updateData.webhook_secret = newSecret;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: "沒有要更新的欄位" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("website_configs")
      .update(updateData)
      .eq("id", id)
      .eq("website_type", "external")
      .select()
      .single();

    if (error || !data) {
      console.error("[SyncTargets] 更新失敗:", error);
      return NextResponse.json({ success: false, error: "更新失敗" }, { status: 500 });
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
      response.message = "webhook_secret 已重新生成。請妥善保存，此後將不會再顯示完整值。";
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[SyncTargets] PATCH 錯誤:", error);
    return NextResponse.json({ success: false, error: "伺服器錯誤" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/sync-targets/[id]
 * 刪除外部網站
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;

    const auth = await verifyAdmin();
    if (!auth.success) return auth.response;

    const adminSupabase = createAdminClient();

    // 先檢查是否存在且為外部網站
    const { data: existing } = await adminSupabase
      .from("website_configs")
      .select("id, website_name")
      .eq("id", id)
      .eq("website_type", "external")
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: "找不到同步目標" }, { status: 404 });
    }

    // 刪除（相關的 article_sync_logs 會因為 ON DELETE SET NULL 保留）
    const { error } = await adminSupabase
      .from("website_configs")
      .delete()
      .eq("id", id)
      .eq("website_type", "external");

    if (error) {
      console.error("[SyncTargets] 刪除失敗:", error);
      return NextResponse.json({ success: false, error: "刪除失敗" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `已刪除同步目標: ${existing.website_name}`,
    });
  } catch (error) {
    console.error("[SyncTargets] DELETE 錯誤:", error);
    return NextResponse.json({ success: false, error: "伺服器錯誤" }, { status: 500 });
  }
}
