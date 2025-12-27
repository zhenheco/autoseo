/**
 * 文章發布 API
 * 支援 WordPress 和 Platform Blog 發布
 */

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";
import { WordPressClient } from "@/lib/wordpress/client";
import {
  decryptWordPressPassword,
  isEncrypted,
} from "@/lib/security/token-encryption";
import { syncCompanyOwnerToBrevo } from "@/lib/brevo";
import { pingAllSearchEngines } from "@/lib/sitemap/ping-service";

/**
 * 文章發布後觸發 sitemap 更新和搜尋引擎 ping
 */
async function revalidateSitemapAndPing(): Promise<void> {
  try {
    // Revalidate 相關 sitemap 路徑
    revalidatePath("/sitemap.xml");
    revalidatePath("/post-sitemap.xml");
    revalidatePath("/category-sitemap.xml");
    revalidatePath("/tag-sitemap.xml");
    console.log("[Publish] Sitemap revalidated");

    // Ping 搜尋引擎（非同步，不阻塞返回）
    pingAllSearchEngines().catch((error) => {
      console.error("[Publish] Sitemap ping 失敗:", error);
    });
  } catch (error) {
    console.error("[Publish] Sitemap revalidate 失敗:", error);
  }
}

export const POST = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    const { id } = extractPathParams(request);

    if (!id) {
      return notFound("文章");
    }

    const body = await request.json();
    const { target, website_id, status: publishStatus = "publish" } = body;

    if (target !== "wordpress" && target !== "platform") {
      return validationError("目前支援 WordPress 和 Platform Blog");
    }

    if (!website_id) {
      return validationError("必須指定目標網站");
    }

    // 查詢網站配置
    const { data: website, error: websiteError } = await supabase
      .from("website_configs")
      .select("*")
      .eq("id", website_id)
      .eq("company_id", companyId)
      .single();

    if (websiteError || !website) {
      return notFound("網站");
    }

    // 查詢文章
    const { data: article, error: articleError } = await supabase
      .from("generated_articles")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (articleError || !article) {
      return notFound("文章");
    }

    // 檢查是否為 Platform Blog
    const isPlatformBlog = website.is_platform_blog === true;

    // Platform Blog 發布：只需更新資料庫
    if (target === "platform" || isPlatformBlog) {
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
        .eq("company_id", companyId);

      if (updateError) {
        return internalError(`發布失敗: ${updateError.message}`);
      }

      // 同步更新 article_jobs 狀態
      if (article.article_job_id) {
        await supabase
          .from("article_jobs")
          .update({
            status: "published",
            published_at: now,
          })
          .eq("id", article.article_job_id);
      }

      // 同步到 Brevo（更新 ARTICLES_PUBLISHED 等屬性）
      syncCompanyOwnerToBrevo(companyId).catch((error) => {
        console.error("[Publish] Brevo 同步失敗（不影響發布）:", error);
      });

      // 觸發 sitemap 更新和搜尋引擎 ping
      revalidateSitemapAndPing();

      return successResponse({
        published_at: now,
        published_to_website_id: website_id,
        published_to_website_at: now,
        platform_url: `/blog/${article.slug}`,
      });
    }

    // WordPress 發布：需要檢查 WordPress 設定
    if (!website.wp_enabled) {
      return validationError("WordPress 發佈功能未啟用，請先在網站設定中啟用");
    }

    if (!website.wordpress_url || !website.wp_app_password) {
      return validationError("WordPress 配置不完整，請檢查網站設定");
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
        .eq("company_id", companyId);

      if (updateError) {
        throw new Error(`資料庫更新失敗: ${updateError.message}`);
      }

      // 同步更新 article_jobs 狀態
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

      // 同步到 Brevo（更新 ARTICLES_PUBLISHED 等屬性）
      syncCompanyOwnerToBrevo(companyId).catch((error) => {
        console.error("[Publish] Brevo 同步失敗（不影響發布）:", error);
      });

      // 觸發 sitemap 更新和搜尋引擎 ping（WordPress 發布也觸發，因為可能同時發布到 Platform Blog）
      revalidateSitemapAndPing();

      return successResponse({
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

      return internalError(
        "發布失敗：" + (error instanceof Error ? error.message : "未知錯誤"),
      );
    }
  },
);
