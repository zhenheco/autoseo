import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

interface ScheduleResult {
  article_id: string;
  title: string;
  success: boolean;
  scheduled_date?: string;
  target_status?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { website_id, articles_per_day, target_status = "publish" } = body;

  if (!website_id) {
    return NextResponse.json({ error: "必須指定目標網站" }, { status: 400 });
  }

  if (!articles_per_day || articles_per_day < 1 || articles_per_day > 10) {
    return NextResponse.json(
      { error: "每日發布數量必須在 1-10 之間" },
      { status: 400 },
    );
  }

  if (!["draft", "publish"].includes(target_status)) {
    return NextResponse.json(
      { error: "發布狀態必須是 draft 或 publish" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("*")
    .eq("id", website_id)
    .eq("company_id", membership.company_id)
    .single();

  if (websiteError || !website) {
    return NextResponse.json(
      { error: "網站不存在或無權限訪問" },
      { status: 404 },
    );
  }

  if (!website.wp_enabled) {
    return NextResponse.json(
      { error: "WordPress 發佈功能未啟用，請先在網站設定中啟用" },
      { status: 400 },
    );
  }

  if (!website.wordpress_url || !website.wp_app_password) {
    return NextResponse.json(
      { error: "WordPress 配置不完整，請檢查網站設定" },
      { status: 400 },
    );
  }

  const { data: articles, error: articlesError } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("company_id", membership.company_id)
    .in("status", ["generated", "reviewed"])
    .is("wordpress_post_id", null)
    .not("title", "is", null)
    .order("created_at", { ascending: true });

  if (articlesError) {
    return NextResponse.json({ error: "取得文章列表失敗" }, { status: 500 });
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json(
      { error: "沒有可排程發布的文章" },
      { status: 400 },
    );
  }

  const results: ScheduleResult[] = [];
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);

  const hoursInterval = Math.floor(12 / articles_per_day);

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const dayIndex = Math.floor(i / articles_per_day);
    const slotIndex = i % articles_per_day;

    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(scheduledDate.getDate() + dayIndex);
    scheduledDate.setHours(9 + slotIndex * hoursInterval);

    // 隨機偏移避免同一時間發佈
    const randomMinutes = Math.floor(Math.random() * 15);
    scheduledDate.setMinutes(randomMinutes);

    try {
      // 只更新資料庫，不呼叫 WordPress API
      // 實際發佈由 GitHub Actions 每小時執行
      const { error: updateError } = await supabase
        .from("generated_articles")
        .update({
          scheduled_publish_at: scheduledDate.toISOString(),
          target_wordpress_status: target_status,
          published_to_website_id: website_id,
          status: "scheduled",
          publish_retry_count: 0,
          last_publish_error: null,
        })
        .eq("id", article.id)
        .eq("company_id", membership.company_id);

      if (updateError) {
        throw updateError;
      }

      results.push({
        article_id: article.id,
        title: article.title,
        success: true,
        scheduled_date: scheduledDate.toISOString(),
        target_status: target_status,
      });
    } catch (error) {
      console.error(`[Schedule] 排程文章失敗 ${article.id}:`, error);
      results.push({
        article_id: article.id,
        title: article.title,
        success: false,
        error: error instanceof Error ? error.message : "未知錯誤",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: true,
    scheduled_count: successCount,
    failed_count: failedCount,
    target_status: target_status,
    results,
  });
}
