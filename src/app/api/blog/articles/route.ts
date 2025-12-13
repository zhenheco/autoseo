import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { BlogArticlesResponse, BlogArticleListItem } from "@/types/blog";

// 使用 service role key 繞過 RLS（因為這是公開 API）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/blog/articles
 * 取得公開 Blog 文章列表
 *
 * Query params:
 * - page: 頁碼（預設 1）
 * - limit: 每頁數量（預設 10，最大 50）
 * - category: 篩選分類
 * - tag: 篩選標籤
 * - sort: 排序方式（recent | popular）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "10")),
    );
    const category = searchParams.get("category");
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sort") || "recent";

    // 先取得平台 Blog 站點 ID
    const { data: platformBlog, error: blogError } = await supabase
      .from("website_configs")
      .select("id")
      .eq("is_platform_blog", true)
      .single();

    if (blogError || !platformBlog) {
      return NextResponse.json(
        { error: "Platform blog not configured" },
        { status: 404 },
      );
    }

    // 建立查詢
    let query = supabase
      .from("generated_articles")
      .select(
        `
        id,
        slug,
        title,
        excerpt,
        featured_image_url,
        categories,
        tags,
        reading_time,
        published_at,
        article_views(total_views)
      `,
        { count: "exact" },
      )
      .eq("published_to_website_id", platformBlog.id)
      .eq("status", "published")
      .not("slug", "is", null);

    // 分類篩選
    if (category) {
      query = query.contains("categories", [category]);
    }

    // 標籤篩選
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    // 排序
    if (sort === "popular") {
      // 依閱讀數排序需要 join article_views
      query = query.order("published_at", { ascending: false });
    } else {
      query = query.order("published_at", { ascending: false });
    }

    // 分頁
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Error fetching blog articles:", error);
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 },
      );
    }

    // 轉換為回應格式
    const articles: BlogArticleListItem[] = (data || []).map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      featured_image_url: article.featured_image_url,
      categories: article.categories || [],
      tags: article.tags || [],
      reading_time: article.reading_time,
      published_at: article.published_at,
      article_views:
        Array.isArray(article.article_views) && article.article_views.length > 0
          ? (article.article_views[0] as { total_views: number })
          : null,
    }));

    // 如果是 popular 排序，在記憶體中排序
    if (sort === "popular") {
      articles.sort((a, b) => {
        const viewsA = a.article_views?.total_views || 0;
        const viewsB = b.article_views?.total_views || 0;
        return viewsB - viewsA;
      });
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    const response: BlogArticlesResponse = {
      articles,
      totalCount,
      totalPages,
      currentPage: page,
      hasMore: page < totalPages,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in blog articles API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
