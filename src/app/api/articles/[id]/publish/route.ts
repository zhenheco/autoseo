import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { WordPressClient } from "@/lib/wordpress/client";
import {
  decryptWordPressPassword,
  isEncrypted,
} from "@/lib/security/token-encryption";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { target, website_id, status: publishStatus = "publish" } = body;

  if (target !== "wordpress" && target !== "platform") {
    return NextResponse.json(
      { error: "目前支援 WordPress 和 Platform Blog" },
      { status: 400 },
    );
  }

  if (!website_id) {
    return NextResponse.json({ error: "必須指定目標網站" }, { status: 400 });
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

  const { data: article, error: articleError } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("id", id)
    .eq("company_id", membership.company_id)
    .single();

  if (articleError || !article) {
    return NextResponse.json(
      { error: "文章不存在或無權限訪問" },
      { status: 404 },
    );
  }

  // 檢查是否為 Platform Blog（1wayseo.com 自營部落格）
  const isPlatformBlog = website.is_platform_blog === true;

  // Platform Blog 發布：只需更新資料庫，不需要 WordPress API
  if (target === "platform" || isPlatformBlog) {
    try {
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("generated_articles")
        .update({
          published_at: now,
          status: "published",
          published_to_website_id: website_id,
          published_to_website_at: now,
        })
        .eq("id", id)
        .eq("company_id", membership.company_id);

      if (updateError) {
        return NextResponse.json(
          { error: `發布失敗: ${updateError.message}` },
          { status: 500 },
        );
      }

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

      return NextResponse.json({
        success: true,
        published_at: now,
        published_to_website_id: website_id,
        published_to_website_at: now,
        platform_url: `/blog/${article.slug}`,
      });
    } catch (error) {
      console.error("Error publishing to Platform Blog:", error);
      return NextResponse.json(
        {
          error:
            "發布失敗：" +
            (error instanceof Error ? error.message : "未知錯誤"),
        },
        { status: 500 },
      );
    }
  }

  // WordPress 發布：需要檢查 WordPress 設定
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

  let wpPostId: number | null = null;

  try {
    // 解密 WordPress 密碼（支援舊資料的明文格式）
    const wpPassword = website.wp_app_password
      ? isEncrypted(website.wp_app_password)
        ? decryptWordPressPassword(website.wp_app_password)
        : website.wp_app_password
      : "";

    const wordpressClient = new WordPressClient({
      url: website.wordpress_url,
      username: website.wp_username || "",
      applicationPassword: wpPassword,
      accessToken: website.wordpress_access_token || undefined,
      refreshToken: website.wordpress_refresh_token || undefined,
    });

    const publishResult = await wordpressClient.publishArticle(
      {
        title: article.seo_title || article.title,
        content: article.html_content || "",
        excerpt: article.seo_description || "",
        slug: article.slug || "",
        featuredImageUrl: article.og_image || undefined,
        categories: article.categories || [],
        tags: article.tags || [],
        seoTitle: article.seo_title || article.title,
        seoDescription: article.seo_description || "",
        focusKeyword: article.focus_keyword || "",
      },
      publishStatus as "publish" | "draft",
    );

    wpPostId = publishResult.post.id;

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("generated_articles")
      .update({
        wordpress_post_id: publishResult.post.id,
        wordpress_post_url: publishResult.post.link,
        wordpress_status: publishResult.post.status,
        published_at: now,
        status: "published",
        published_to_website_id: website_id,
        published_to_website_at: now,
      })
      .eq("id", id)
      .eq("company_id", membership.company_id);

    if (updateError) {
      throw new Error(`資料庫更新失敗: ${updateError.message}`);
    }

    // 同步更新 article_jobs 狀態（如果有關聯）
    if (article.article_job_id) {
      await supabase
        .from("article_jobs")
        .update({
          status: "published",
          published_at: now,
          wordpress_post_id: publishResult.post.id?.toString(),
        })
        .eq("id", article.article_job_id);
    }

    return NextResponse.json({
      success: true,
      wordpress_post_id: publishResult.post.id,
      wordpress_url: publishResult.post.link,
      published_at: now,
      published_to_website_id: website_id,
      published_to_website_at: now,
    });
  } catch (error) {
    console.error("Error publishing article:", error);

    if (wpPostId) {
      console.warn(
        `WordPress 發佈成功但資料庫更新失敗，post_id: ${wpPostId}，需要手動處理`,
      );
    }

    return NextResponse.json(
      {
        error:
          "發布失敗：" + (error instanceof Error ? error.message : "未知錯誤"),
      },
      { status: 500 },
    );
  }
}
