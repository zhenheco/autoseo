import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type {
  BlogArticle,
  BlogArticleListItem,
  BlogArticleResponse,
} from "@/types/blog";

// 使用 service role key 繞過 RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/blog/articles/[slug]
 * 取得單篇公開 Blog 文章詳情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

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

    // 取得文章詳情
    const { data: article, error: articleError } = await supabase
      .from("generated_articles")
      .select(
        `
        id,
        slug,
        title,
        excerpt,
        html_content,
        featured_image_url,
        featured_image_alt,
        categories,
        tags,
        reading_time,
        word_count,
        published_at,
        created_at,
        updated_at,
        seo_title,
        seo_description,
        focus_keyword,
        keywords,
        og_title,
        og_description,
        og_image,
        article_views(total_views, views_this_week)
      `,
      )
      .eq("published_to_website_id", platformBlog.id)
      .eq("status", "published")
      .eq("slug", slug)
      .single();

    if (articleError || !article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // 取得相關文章（同分類或同標籤，排除當前文章）
    const categories = article.categories || [];
    const tags = article.tags || [];

    let relatedQuery = supabase
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
      )
      .eq("published_to_website_id", platformBlog.id)
      .eq("status", "published")
      .neq("id", article.id)
      .not("slug", "is", null)
      .limit(4);

    // 如果有分類，優先找同分類的文章
    if (categories.length > 0) {
      relatedQuery = relatedQuery.overlaps("categories", categories);
    } else if (tags.length > 0) {
      relatedQuery = relatedQuery.overlaps("tags", tags);
    }

    const { data: relatedData } = await relatedQuery;

    // 轉換為回應格式
    const blogArticle: BlogArticle = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      html_content: article.html_content,
      featured_image_url: article.featured_image_url,
      featured_image_alt: article.featured_image_alt,
      categories: article.categories || [],
      tags: article.tags || [],
      reading_time: article.reading_time,
      word_count: article.word_count,
      published_at: article.published_at,
      created_at: article.created_at,
      updated_at: article.updated_at,
      seo_title: article.seo_title,
      seo_description: article.seo_description,
      focus_keyword: article.focus_keyword,
      keywords: article.keywords,
      og_title: article.og_title,
      og_description: article.og_description,
      og_image: article.og_image,
      article_views:
        Array.isArray(article.article_views) && article.article_views.length > 0
          ? (article.article_views[0] as {
              total_views: number;
              views_this_week: number;
            })
          : null,
    };

    const relatedArticles: BlogArticleListItem[] = (relatedData || []).map(
      (item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        excerpt: item.excerpt,
        featured_image_url: item.featured_image_url,
        categories: item.categories || [],
        tags: item.tags || [],
        reading_time: item.reading_time,
        published_at: item.published_at,
        article_views:
          Array.isArray(item.article_views) && item.article_views.length > 0
            ? (item.article_views[0] as { total_views: number })
            : null,
      }),
    );

    const response: BlogArticleResponse = {
      article: blogArticle,
      relatedArticles,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in blog article API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
