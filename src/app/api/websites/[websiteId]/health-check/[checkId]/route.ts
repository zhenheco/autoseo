/**
 * 單一健康檢查結果 API
 * GET: 取得指定的健檢結果
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WebsiteHealthService } from "@/lib/services/website-health-service";

/**
 * GET /api/websites/[websiteId]/health-check/[checkId]
 * 取得指定的健康檢查結果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string; checkId: string }> },
) {
  try {
    const { websiteId, checkId } = await params;

    // 驗證用戶身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授權" },
        { status: 401 },
      );
    }

    // 取得網站資訊並驗證權限
    const { data: website, error: websiteError } = await supabase
      .from("website_configs")
      .select("id, company_id")
      .eq("id", websiteId)
      .single();

    if (websiteError || !website) {
      return NextResponse.json(
        { success: false, error: "找不到網站" },
        { status: 404 },
      );
    }

    // 驗證用戶是否屬於該公司
    const { data: membership, error: memberError } = await supabase
      .from("company_members")
      .select("id")
      .eq("company_id", website.company_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { success: false, error: "無權限存取此網站" },
        { status: 403 },
      );
    }

    // 取得健檢結果
    const { data, error } = await supabase
      .from("website_health_checks")
      .select("*")
      .eq("id", checkId)
      .eq("website_id", websiteId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "找不到健檢結果" },
        { status: 404 },
      );
    }

    // 使用 Service 轉換資料格式
    const healthService = new WebsiteHealthService(supabase);
    // @ts-expect-error - 使用私有方法進行資料轉換
    const result = healthService.mapDbRowToResult(data);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[HealthCheck API] 錯誤:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "取得健檢結果失敗",
      },
      { status: 500 },
    );
  }
}
