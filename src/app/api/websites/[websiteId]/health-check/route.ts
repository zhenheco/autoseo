/**
 * 網站健康檢查 API
 * POST: 觸發健檢
 * GET: 取得最新結果
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WebsiteHealthService } from "@/lib/services/website-health-service";
import type {
  TriggerHealthCheckRequest,
  TriggerHealthCheckResponse,
  DeviceType,
} from "@/types/health-check";

// 同步處理模式，設定較長的超時時間（60 秒足夠）
export const maxDuration = 60;

/**
 * POST /api/websites/[websiteId]/health-check
 * 觸發網站健康檢查
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  try {
    const { websiteId } = await params;
    const body = (await request.json()) as TriggerHealthCheckRequest;

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
      .select("id, company_id, url, name")
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

    // 執行健康檢查
    const healthService = new WebsiteHealthService(supabase);

    const result = await healthService.runHealthCheck({
      websiteId,
      companyId: website.company_id,
      url: body.url || website.url,
      device: (body.device as DeviceType) || "mobile",
      includeAIRecommendations: body.includeAIRecommendations !== false,
    });

    const response: TriggerHealthCheckResponse = {
      success: true,
      healthCheckId: result.id,
      message: "健康檢查完成",
      result,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[HealthCheck API] 錯誤:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "健康檢查失敗",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/websites/[websiteId]/health-check
 * 取得最新的健康檢查結果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  try {
    const { websiteId } = await params;

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

    // 取得最新結果
    const healthService = new WebsiteHealthService(supabase);
    const result = await healthService.getLatestHealthCheck(websiteId);

    if (!result) {
      return NextResponse.json(
        { success: true, result: null, message: "尚未執行過健康檢查" },
        { status: 200 },
      );
    }

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
