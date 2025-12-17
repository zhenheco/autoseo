/**
 * AI 生成社群文案 API
 *
 * POST /api/social/ai/generate-content - 將文章內容轉換為社群貼文
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createSocialContentAgent,
  extractArticleSummary,
  type SocialPlatform,
} from "@/lib/social/social-content-agent";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 取得當前用戶
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 取得用戶的公司 ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "找不到公司資訊" }, { status: 404 });
    }

    // 解析請求
    const body = await request.json();
    const { articleId, platform } = body;

    if (!articleId) {
      return NextResponse.json({ error: "請提供文章 ID" }, { status: 400 });
    }

    const targetPlatform: SocialPlatform = platform || "instagram";

    // 取得文章內容
    const { data: article, error: articleError } = await supabase
      .from("generated_articles")
      .select("id, title, html_content, keywords")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      return NextResponse.json({ error: "找不到文章" }, { status: 404 });
    }

    // 驗證文章屬於該公司
    const { data: job } = await supabase
      .from("article_jobs")
      .select("company_id")
      .eq("generated_articles!inner(id)", articleId)
      .single();

    if (!job || job.company_id !== profile.company_id) {
      return NextResponse.json({ error: "無權限存取此文章" }, { status: 403 });
    }

    // 提取文章摘要
    const keywords = Array.isArray(article.keywords)
      ? article.keywords
      : typeof article.keywords === "string"
        ? [article.keywords]
        : [];

    const summary = extractArticleSummary(
      article.html_content || "",
      article.title || "",
      keywords,
    );

    // 生成社群文案
    const agent = createSocialContentAgent();
    const content = await agent.generate(summary, {
      platform: targetPlatform,
      language: "繁體中文",
    });

    return NextResponse.json({
      success: true,
      content,
      articleTitle: article.title,
      platform: targetPlatform,
    });
  } catch (error) {
    console.error("[API] AI 生成社群文案失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "生成社群文案失敗",
      },
      { status: 500 },
    );
  }
}
