import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { WordPressClient } from "@/lib/wordpress/client";

interface ScheduleResult {
  article_id: string;
  title: string;
  success: boolean;
  scheduled_date?: string;
  wordpress_post_id?: number;
  wordpress_url?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { website_id, articles_per_day } = body;

  if (!website_id) {
    return NextResponse.json({ error: "必須指定目標網站" }, { status: 400 });
  }

  if (!articles_per_day || articles_per_day < 1 || articles_per_day > 10) {
    return NextResponse.json(
      { error: "每日發布數量必須在 1-10 之間" },
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

  const wordpressClient = new WordPressClient({
    url: website.wordpress_url,
    username: website.wp_username || "",
    applicationPassword: website.wp_app_password,
    accessToken: website.wordpress_access_token || undefined,
    refreshToken: website.wordpress_refresh_token || undefined,
  });

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

    try {
      const { categoryIds, tagIds } = await wordpressClient.ensureTaxonomies(
        article.categories || [],
        article.tags || [],
      );

      let featuredMediaId: number | undefined;
      if (article.og_image) {
        try {
          const media = await wordpressClient.uploadMediaFromUrl(
            article.og_image,
            `${article.slug || "article"}-featured`,
          );
          featuredMediaId = media.id;
        } catch (mediaError) {
          console.warn(`[Schedule] 無法上傳精選圖片: ${mediaError}`);
        }
      }

      const response = await fetch(
        `${website.wordpress_url.replace(/\/$/, "")}/wp-json/wp/v2/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              `${website.wp_username}:${website.wp_app_password}`,
            ).toString("base64")}`,
          },
          body: JSON.stringify({
            title: article.seo_title || article.title,
            content: article.html_content || "",
            excerpt: article.seo_description || "",
            slug: article.slug || "",
            status: "future",
            date: scheduledDate.toISOString(),
            categories: categoryIds,
            tags: tagIds,
            featured_media: featuredMediaId,
            meta: {
              yoast_wpseo_title: article.seo_title || article.title,
              yoast_wpseo_metadesc: article.seo_description || "",
              yoast_wpseo_focuskw: article.focus_keyword || "",
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `WordPress API 錯誤: ${response.status} - ${errorText}`,
        );
      }

      const wpPost = await response.json();

      await supabase
        .from("generated_articles")
        .update({
          wordpress_post_id: wpPost.id,
          wordpress_post_url: wpPost.link,
          wordpress_status: "future",
          status: "published",
          scheduled_publish_at: scheduledDate.toISOString(),
          published_to_website_id: website_id,
          published_to_website_at: new Date().toISOString(),
        })
        .eq("id", article.id)
        .eq("company_id", membership.company_id);

      results.push({
        article_id: article.id,
        title: article.title,
        success: true,
        scheduled_date: scheduledDate.toISOString(),
        wordpress_post_id: wpPost.id,
        wordpress_url: wpPost.link,
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
    results,
  });
}
