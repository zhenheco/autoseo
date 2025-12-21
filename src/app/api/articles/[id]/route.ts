/**
 * 文章編輯與刪除 API
 */

import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";

/**
 * PATCH /api/articles/[id]
 * 更新文章內容
 */
export const PATCH = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    const { id } = extractPathParams(request);

    if (!id) {
      return notFound("文章");
    }

    const body = await request.json();
    const {
      html_content,
      content_json,
      title,
      published_to_website_id,
      published_to_website_at,
      seo_title,
      seo_description,
    } = body;

    // 驗證輸入格式
    if (html_content && typeof html_content !== "string") {
      return validationError("HTML 內容格式錯誤");
    }

    if (content_json && typeof content_json !== "object") {
      return validationError("JSON 內容格式錯誤");
    }

    if (title && typeof title !== "string") {
      return validationError("標題格式錯誤");
    }

    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (title) {
        updateData.title = title;
      }

      // 處理 HTML 內容（清理和計算字數）
      if (html_content) {
        const sanitizedHtml = sanitizeHtml(html_content, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            "img",
            "iframe",
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ["src", "alt", "title", "width", "height"],
            iframe: [
              "src",
              "width",
              "height",
              "frameborder",
              "allow",
              "allowfullscreen",
            ],
            a: ["href", "name", "target", "rel"],
          },
          allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
        });

        const $ = cheerio.load(sanitizedHtml);
        const bodyText = $("body").text().trim();

        if (bodyText.length === 0) {
          return validationError("HTML 內容為空");
        }

        updateData.html_content = sanitizedHtml;
        updateData.word_count = bodyText.length;
        updateData.reading_time = Math.ceil(bodyText.length / 300);
      }

      if (content_json) {
        updateData.content_json = content_json;
      }

      if (published_to_website_id !== undefined) {
        updateData.published_to_website_id = published_to_website_id;
      }

      if (published_to_website_at !== undefined) {
        updateData.published_to_website_at = published_to_website_at;
      }

      if (seo_title !== undefined) {
        updateData.seo_title = seo_title;
      }

      if (seo_description !== undefined) {
        updateData.seo_description = seo_description;
      }

      const { data, error } = await supabase
        .from("generated_articles")
        .update(updateData)
        .eq("id", id)
        .eq("company_id", companyId)
        .select()
        .single();

      if (error) {
        console.error("Error updating article:", error);
        return internalError(error.message);
      }

      if (!data) {
        return notFound("文章");
      }

      return successResponse({
        article: {
          id: data.id,
          html_content: data.html_content,
          word_count: data.word_count,
          reading_time: data.reading_time,
          updated_at: data.updated_at,
        },
      });
    } catch (error) {
      console.error("Error processing HTML:", error);
      return validationError("HTML 結構無效");
    }
  },
);

/**
 * DELETE /api/articles/[id]
 * 刪除文章（及關聯的任務）
 */
export const DELETE = withCompany(
  async (request: NextRequest, { supabase, companyId }) => {
    const { id } = extractPathParams(request);

    if (!id) {
      return notFound("文章");
    }

    // 檢查文章是否有關聯的任務
    const { data: article } = await supabase
      .from("generated_articles")
      .select("article_job_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    // 如果有關聯任務，透過 CASCADE 刪除任務（會自動刪除文章）
    if (article?.article_job_id) {
      const { error } = await supabase
        .from("article_jobs")
        .delete()
        .eq("id", article.article_job_id)
        .eq("company_id", companyId);

      if (error) {
        console.error("Error deleting article_job:", error);
        return internalError(error.message);
      }
    } else {
      // 沒有關聯任務，直接刪除文章
      const { error } = await supabase
        .from("generated_articles")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);

      if (error) {
        console.error("Error deleting article:", error);
        return internalError(error.message);
      }
    }

    return successResponse(null);
  },
);
