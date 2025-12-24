/**
 * 健康檢查歷史 API
 * GET: 取得健檢歷史記錄
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WebsiteHealthService } from "@/lib/services/website-health-service";
import type { HealthCheckHistoryResponse } from "@/types/health-check";

/**
 * GET /api/websites/[websiteId]/health-check/history
 * 取得健康檢查歷史記錄
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  try {
    const { websiteId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析分頁參數
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") || "10", 10),
      50,
    );

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

    // 取得歷史記錄
    const healthService = new WebsiteHealthService(supabase);
    const { checks, total } = await healthService.getHealthCheckHistory(
      websiteId,
      page,
      pageSize,
    );

    const response: HealthCheckHistoryResponse = {
      checks: checks.map((check) => ({
        id: check.id,
        websiteId: check.websiteId,
        status: check.status,
        urlChecked: check.urlChecked,
        deviceType: check.deviceType,
        scores: check.scores,
        recommendationCount: check.recommendations.length,
        createdAt: check.createdAt,
        completedAt: check.completedAt,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    return NextResponse.json({ success: true, ...response });
  } catch (error) {
    console.error("[HealthCheck History API] 錯誤:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "取得歷史記錄失敗",
      },
      { status: 500 },
    );
  }
}
