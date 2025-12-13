import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TagsResponse, TagCount } from "@/types/blog";

// 使用 service role key 繞過 RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/blog/tags
 * 取得所有標籤及其文章數量
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

    // 取得所有已發布文章的標籤
    const { data: articles, error: articlesError } = await supabase
      .from("generated_articles")
      .select("tags")
      .eq("published_to_website_id", platformBlog.id)
      .eq("status", "published")
      .not("tags", "is", null);

    if (articlesError) {
      console.error("Error fetching tags:", articlesError);
      return NextResponse.json(
        { error: "Failed to fetch tags" },
        { status: 500 },
      );
    }

    // 統計各標籤的文章數量
    const tagCountMap = new Map<string, number>();

    for (const article of articles || []) {
      const tags = article.tags || [];
      for (const tag of tags) {
        if (tag && typeof tag === "string") {
          tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
        }
      }
    }

    // 轉換為陣列並排序
    const tags: TagCount[] = Array.from(tagCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const response: TagsResponse = {
      tags,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in blog tags API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
