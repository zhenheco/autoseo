/**
 * 文章列表 API
 * 使用統一中間件處理認證和錯誤
 */

import { withCompany } from "@/lib/api/auth-middleware";
import { successResponse, internalError } from "@/lib/api/response-helpers";

/**
 * GET /api/articles
 * 取得公司的文章列表
 */
export const GET = withCompany(async (request, { supabase, companyId }) => {
  const { data: articles, error } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      title,
      slug,
      status,
      quality_score,
      word_count,
      reading_time,
      wordpress_post_url,
      created_at,
      published_at,
      html_content,
      published_to_website_id,
      published_to_website_at
    `,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Failed to fetch articles:", error);
    return internalError("Failed to fetch articles");
  }

  return successResponse({ articles: articles || [] });
});
