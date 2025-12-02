import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{
    jobId: string;
  }>;
}

/**
 * GET /api/articles/status/[jobId]
 * 查詢文章生成任務的狀態
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;

    // 支持兩種認證方式：
    // 1. Authorization header（用於 API/curl 請求）
    // 2. Cookies（用於瀏覽器請求）
    const authHeader = request.headers.get("authorization");
    let user = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { createClient: createSupabaseClient } = await import(
        "@supabase/supabase-js"
      );
      const authClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      // 使用 JWT token 獲取用戶信息
      const { data: userData, error: userError } =
        await authClient.auth.getUser(token);

      if (userError || !userData.user) {
        return NextResponse.json(
          { error: "Invalid token", details: userError?.message },
          { status: 401 },
        );
      }

      user = userData.user;
    } else {
      const cookieClient = await createClient();
      const {
        data: { user: cookieUser },
      } = await cookieClient.auth.getUser();
      user = cookieUser;
    }

    // 使用 service role client 進行資料庫查詢（避免 RLS 問題）
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No active company membership" },
        { status: 403 },
      );
    }

    // 查詢任務狀態（確保只能查詢自己公司的任務）
    const { data: job, error } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("company_id", membership.company_id)
      .single();

    if (error) {
      console.error("Failed to fetch job status:", error);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Get job status error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
