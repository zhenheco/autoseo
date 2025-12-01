import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
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

  if (html_content && typeof html_content !== "string") {
    return NextResponse.json({ error: "HTML 內容格式錯誤" }, { status: 400 });
  }

  if (content_json && typeof content_json !== "object") {
    return NextResponse.json({ error: "JSON 內容格式錯誤" }, { status: 400 });
  }

  if (title && typeof title !== "string") {
    return NextResponse.json({ error: "標題格式錯誤" }, { status: 400 });
  }

  try {
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

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title) {
      updateData.title = title;
    }

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
        return NextResponse.json({ error: "HTML 內容為空" }, { status: 400 });
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
      .eq("company_id", membership.company_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating article:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "文章不存在或無權限編輯" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
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
    return NextResponse.json({ error: "HTML 結構無效" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
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

    const { data: article } = await supabase
      .from("generated_articles")
      .select("article_job_id")
      .eq("id", id)
      .eq("company_id", membership.company_id)
      .single();

    if (article?.article_job_id) {
      const { error } = await supabase
        .from("article_jobs")
        .delete()
        .eq("id", article.article_job_id)
        .eq("company_id", membership.company_id);

      if (error) {
        console.error("Error deleting article_job:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("generated_articles")
        .delete()
        .eq("id", id)
        .eq("company_id", membership.company_id);

      if (error) {
        console.error("Error deleting article:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json({ error: "刪除失敗" }, { status: 500 });
  }
}
