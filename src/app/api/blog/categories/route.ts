import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CategoriesResponse, CategoryCount } from "@/types/blog";

// 使用 service role key 繞過 RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/blog/categories
 * 取得所有分類及其文章數量
 */
export async function GET() {
  try {
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

    // 取得所有已發布文章的分類
    const { data: articles, error: articlesError } = await supabase
      .from("generated_articles")
      .select("categories")
      .eq("published_to_website_id", platformBlog.id)
      .eq("status", "published")
      .not("categories", "is", null);

    if (articlesError) {
      console.error("Error fetching categories:", articlesError);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 },
      );
    }

    // 統計各分類的文章數量
    const categoryCountMap = new Map<string, number>();

    for (const article of articles || []) {
      const categories = article.categories || [];
      for (const category of categories) {
        if (category && typeof category === "string") {
          categoryCountMap.set(
            category,
            (categoryCountMap.get(category) || 0) + 1,
          );
        }
      }
    }

    // 轉換為陣列並排序
    const categories: CategoryCount[] = Array.from(categoryCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const response: CategoriesResponse = {
      categories,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in blog categories API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
