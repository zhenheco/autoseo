/**
 * 外部網站（同步目標）管理 API
 * 用於管理文章同步到的外部專案
 * 現在使用 website_configs 表（website_type = 'external'）
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils/admin-check";

export const dynamic = "force-dynamic";

// Ace 的公司 ID（目前外部網站都屬於此公司）
const ACE_COMPANY_ID = "1c9c2d1d-3b26-4ab1-971f-98a980fdbce9";

/**
 * 驗證管理員權限
 * @returns 驗證結果和錯誤回應（如果有）
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
 * 脫敏同步目標資料
 */
function sanitizeTarget<T extends { webhook_secret?: string | null }>(target: T): T {
  return {
    ...target,
    webhook_secret: target.webhook_secret ? "******" : null,
  };
}

/**
 * GET /api/admin/sync-targets
 * 取得所有外部網站（同步目標）
 */
export async function GET(): Promise<NextResponse> {
  try {
    const auth = await verifyAdmin();
    if (!auth.success) return auth.response;

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("website_configs")
      .select("*")
      .eq("website_type", "external")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SyncTargets] 查詢失敗:", error);
      return NextResponse.json({ success: false, error: "查詢失敗" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data.map(sanitizeTarget),
    });
  } catch (error) {
    console.error("[SyncTargets] GET 錯誤:", error);
    return NextResponse.json({ success: false, error: "伺服器錯誤" }, { status: 500 });
  }
}

/**
 * POST /api/admin/sync-targets
 * 建立新的外部網站（同步目標）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await verifyAdmin();
    if (!auth.success) return auth.response;

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
      return NextResponse.json({ success: false, error: "name, slug, webhook_url 為必填" }, { status: 400 });
    }

    // 驗證 slug 格式
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ success: false, error: "slug 只能包含小寫字母、數字和連字符" }, { status: 400 });
    }

    // 驗證 webhook_url 格式
    try {
      new URL(webhook_url);
    } catch {
      return NextResponse.json({ success: false, error: "webhook_url 格式無效" }, { status: 400 });
    }

    // 生成隨機的 webhook_secret
    const webhook_secret = crypto.randomBytes(32).toString("hex");

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
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
        return NextResponse.json({ success: false, error: "slug 已存在" }, { status: 409 });
      }
      console.error("[SyncTargets] 建立失敗:", error);
      return NextResponse.json({ success: false, error: "建立失敗" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { ...data, webhook_secret },
      message: "建立成功。請妥善保存 webhook_secret，此後將不會再顯示完整值。",
    });
  } catch (error) {
    console.error("[SyncTargets] POST 錯誤:", error);
    return NextResponse.json({ success: false, error: "伺服器錯誤" }, { status: 500 });
  }
}
