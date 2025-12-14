import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    article_ids,
    website_id,
    target,
    status: publishStatus = "publish",
  } = body;

  if (!article_ids || !Array.isArray(article_ids) || article_ids.length === 0) {
    return NextResponse.json(
      { error: "必須提供至少一篇文章 ID" },
      { status: 400 },
    );
  }

  if (!website_id) {
    return NextResponse.json({ error: "必須指定目標網站" }, { status: 400 });
  }

  if (target !== "wordpress") {
    return NextResponse.json(
      { error: "目前僅支援 WordPress" },
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

  const results: Array<{
    article_id: string;
    success: boolean;
    error?: string;
  }> = [];

  let successCount = 0;
  let failedCount = 0;

  for (const articleId of article_ids) {
    try {
      const { data: article, error: articleError } = await supabase
        .from("generated_articles")
        .select("id, article_job_id")
        .eq("id", articleId)
        .eq("company_id", membership.company_id)
        .single();

      if (articleError || !article) {
        results.push({
          article_id: articleId,
          success: false,
          error: "文章不存在或無權限訪問",
        });
        failedCount++;
        continue;
      }

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("generated_articles")
        .update({
          wordpress_status: publishStatus,
          published_at: now,
          status: "published",
          published_to_website_id: website_id,
          published_to_website_at: now,
        })
        .eq("id", articleId)
        .eq("company_id", membership.company_id);

      if (updateError) {
        results.push({
          article_id: articleId,
          success: false,
          error: updateError.message,
        });
        failedCount++;
      } else {
        // 同步更新 article_jobs 狀態（如果有關聯）
        if (article.article_job_id) {
          await supabase
            .from("article_jobs")
            .update({
              status: "published",
              published_at: now,
            })
            .eq("id", article.article_job_id);
        }

        results.push({
          article_id: articleId,
          success: true,
        });
        successCount++;
      }
    } catch (error) {
      results.push({
        article_id: articleId,
        success: false,
        error: error instanceof Error ? error.message : "未知錯誤",
      });
      failedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    results,
    stats: {
      total: article_ids.length,
      success: successCount,
      failed: failedCount,
    },
  });
}
