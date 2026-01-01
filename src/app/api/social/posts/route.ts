/**
 * 社群發文 API
 *
 * POST /api/social/posts - 建立社群發文
 * GET /api/social/posts - 取得發文列表
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBasClientFromConfig } from "@/lib/social/bas-client";

/**
 * 建立社群發文
 */
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
    const {
      articleId,
      selectedAccounts,
      content,
      contentStyle,
      mediaUrl,
      hashtags,
      scheduledAt,
    } = body;

    if (!content || !selectedAccounts || selectedAccounts.length === 0) {
      return NextResponse.json(
        { error: "請提供文案內容和發布帳號" },
        { status: 400 },
      );
    }

    // 取得社群設定
    const { data: config, error: configError } = await supabase
      .from("social_account_configs")
      .select("*")
      .eq("company_id", profile.company_id)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: "請先設定發文小助手 API" },
        { status: 400 },
      );
    }

    // 建立發文小助手 API Client
    const basClient = createBasClientFromConfig({
      bas_api_key: config.bas_api_key,
      bas_user_id: config.bas_user_id,
    });

    // 組合文案和 hashtag
    const hashtagStr =
      hashtags && hashtags.length > 0
        ? "\n\n" + hashtags.map((h: string) => `#${h}`).join(" ")
        : "";
    const fullContent = content + hashtagStr;

    // 呼叫發文小助手 API 建立發文
    const basResponse = await basClient.createPost({
      content: fullContent,
      selectedAccounts: selectedAccounts.map(
        (acc: {
          platform: string;
          accountId: string;
          accountName: string;
        }) => ({
          platform: acc.platform as "facebook" | "instagram" | "threads",
          accountId: acc.accountId,
          accountName: acc.accountName,
        }),
      ),
      mediaUrl,
      scheduledTime: scheduledAt,
      hashtags,
    });

    if (!basResponse.success) {
      // 檢查是否為發文小助手額度不足錯誤
      const errorMsg =
        basResponse.error || basResponse.message || "發文失敗，請稍後再試";
      const isInsufficientCredits =
        errorMsg.includes("額度不足") ||
        errorMsg.includes("insufficient") ||
        errorMsg.includes("credit") ||
        errorMsg.includes("quota");

      return NextResponse.json(
        {
          error: errorMsg,
          code: isInsufficientCredits ? "INSUFFICIENT_CREDITS" : "POST_FAILED",
        },
        { status: isInsufficientCredits ? 402 : 500 },
      );
    }

    // 建立發文記錄
    const postsToInsert = selectedAccounts.map(
      (acc: { platform: string; accountId: string }) => ({
        company_id: profile.company_id,
        article_id: articleId || null,
        account_id: acc.accountId,
        platform: acc.platform,
        external_post_id: basResponse.postId,
        content: fullContent,
        content_style: contentStyle || null,
        media_url: mediaUrl || null,
        hashtags: hashtags || [],
        scheduled_at: scheduledAt || null,
        status: scheduledAt ? "pending" : "published",
        published_at: scheduledAt ? null : new Date().toISOString(),
      }),
    );

    const { error: insertError } = await supabase
      .from("social_posts")
      .insert(postsToInsert);

    if (insertError) {
      console.error("[API] 記錄發文失敗:", insertError);
    }

    return NextResponse.json({
      success: true,
      postId: basResponse.postId,
      message: scheduledAt ? "發文已排程" : "發文成功",
    });
  } catch (error) {
    console.error("[API] 建立社群發文失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "建立社群發文失敗",
      },
      { status: 500 },
    );
  }
}

/**
 * 取得發文列表
 */
export async function GET(request: NextRequest) {
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

    // 取得分頁參數
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // 取得發文列表
    const {
      data: posts,
      error: postsError,
      count,
    } = await supabase
      .from("social_posts")
      .select("*, generated_articles(title)", { count: "exact" })
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (postsError) {
      throw new Error(`查詢發文失敗: ${postsError.message}`);
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("[API] 取得發文列表失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取得發文列表失敗",
      },
      { status: 500 },
    );
  }
}
