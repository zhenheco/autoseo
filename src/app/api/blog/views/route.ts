import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 使用 service role key 繞過 RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/blog/views
 * 記錄文章閱讀次數
 *
 * Body:
 * - articleId: 文章 ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 },
      );
    }

    // 先檢查 article_views 記錄是否存在
    const { data: existingView, error: selectError } = await supabase
      .from("article_views")
      .select("id, total_views, views_today, views_this_week, views_this_month")
      .eq("article_id", articleId)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 = no rows found，這是正常的
      console.error("Error checking article views:", selectError);
      return NextResponse.json(
        { error: "Failed to check article views" },
        { status: 500 },
      );
    }

    if (existingView) {
      // 更新現有記錄
      const { error: updateError } = await supabase
        .from("article_views")
        .update({
          total_views: existingView.total_views + 1,
          views_today: existingView.views_today + 1,
          views_this_week: existingView.views_this_week + 1,
          views_this_month: existingView.views_this_month + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", existingView.id);

      if (updateError) {
        console.error("Error updating article views:", updateError);
        return NextResponse.json(
          { error: "Failed to update article views" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        totalViews: existingView.total_views + 1,
      });
    } else {
      // 建立新記錄
      const { error: insertError } = await supabase
        .from("article_views")
        .insert({
          article_id: articleId,
          total_views: 1,
          unique_views: 1,
          views_today: 1,
          views_this_week: 1,
          views_this_month: 1,
          last_viewed_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Error inserting article views:", insertError);
        return NextResponse.json(
          { error: "Failed to record article view" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        totalViews: 1,
      });
    }
  } catch (error) {
    console.error("Unexpected error in blog views API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
