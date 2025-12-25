import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * GET /api/websites/[id]/health-check/history
 * 取得健康檢查歷史記錄
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: websiteId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    // 驗證用戶身份
    const cookieClient = await createClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 使用 service role client
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 驗證用戶有權限查看此網站
    const { data: website } = await supabase
      .from("website_configs")
      .select("id, company_id")
      .eq("id", websiteId)
      .single();

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", website.company_id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this website" },
        { status: 403 },
      );
    }

    // 取得已完成的健康檢查結果
    const {
      data: results,
      error: resultsError,
      count,
    } = await supabase
      .from("website_health_checks")
      .select("*", { count: "exact" })
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (resultsError) {
      console.error("[Health Check API] Error fetching history:", resultsError);
      return NextResponse.json(
        { error: "Failed to fetch health check history" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      results: results || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Health Check API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
