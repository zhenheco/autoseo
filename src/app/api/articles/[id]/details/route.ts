/**
 * 文章詳情 API
 */

import { NextRequest } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import { successResponse, notFound } from "@/lib/api/response-helpers";

export const GET = withCompany(
  async (
    request: NextRequest & { params?: Promise<{ id: string }> },
    { supabase, companyId },
  ) => {
    // Next.js 15+ 動態路由參數從 URL 獲取
    const url = new URL(request.url);
    const id = url.pathname.split("/").slice(-2, -1)[0];

    const { data: article, error } = await supabase
      .from("generated_articles")
      .select("id, title, html_content, word_count, reading_time, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (error || !article) {
      return notFound("文章");
    }

    return successResponse(article);
  },
);
