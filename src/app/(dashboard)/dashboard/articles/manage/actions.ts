"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ArticleWithWebsite {
  id: string;
  job_id: string;
  company_id: string;
  website_id: string | null;
  user_id: string;
  keywords: string[];
  status: string;
  article_title: string | null;
  input_type: string | null;
  input_content: Record<string, unknown> | null;
  generated_content: Record<string, unknown> | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  wp_post_id: string | null;
  website_configs: {
    id: string;
    website_name: string;
    wordpress_url: string;
  } | null;
}

export interface GeneratedArticle {
  id: string;
  article_job_id: string;
  title: string;
  content: string;
  meta_description: string | null;
  status: string;
  published_to_website_id: string | null;
  published_url: string | null;
  wp_post_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export async function getArticles(
  filter: "all" | "unpublished" | "published" = "all",
) {
  const user = await getUser();
  if (!user) return { articles: [], error: "未登入" };

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const companyId = membership?.company_id || user.id;

  let query = supabase
    .from("article_jobs")
    .select(
      `
      *,
      website_configs (
        id,
        website_name,
        wordpress_url
      )
    `,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (filter === "unpublished") {
    query = query.in("status", ["pending", "processing", "draft", "completed"]);
  } else if (filter === "published") {
    query = query.eq("status", "published");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch articles:", error);
    return { articles: [], error: error.message };
  }

  return { articles: data as ArticleWithWebsite[], error: null };
}

export async function getGeneratedArticle(articleJobId: string) {
  const user = await getUser();
  if (!user) return { article: null, error: "未登入" };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("article_job_id", articleJobId)
    .single();

  if (error) {
    console.error("Failed to fetch generated article:", error);
    return { article: null, error: error.message };
  }

  return { article: data as GeneratedArticle, error: null };
}

export async function assignWebsiteToArticle(
  articleJobId: string,
  websiteId: string,
) {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  const { error: jobError } = await supabase
    .from("article_jobs")
    .update({ website_id: websiteId })
    .eq("id", articleJobId);

  if (jobError) {
    console.error("Failed to assign website to article job:", jobError);
    return { success: false, error: jobError.message };
  }

  const { error: generatedError } = await supabase
    .from("generated_articles")
    .update({ published_to_website_id: websiteId })
    .eq("article_job_id", articleJobId);

  if (generatedError) {
    console.error("Failed to update generated article:", generatedError);
  }

  revalidatePath("/dashboard/articles/manage");
  return { success: true, error: null };
}

export async function publishArticle(articleJobId: string, websiteId: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  const { data: article, error: fetchError } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("article_job_id", articleJobId)
    .single();

  if (fetchError || !article) {
    return { success: false, error: "找不到文章內容" };
  }

  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("*")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    return { success: false, error: "找不到網站配置" };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/wordpress/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          websiteId: websiteId,
          title: article.title,
          content: article.content,
          metaDescription: article.meta_description,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || "發布失敗" };
    }

    const result = await response.json();

    await supabase
      .from("generated_articles")
      .update({
        status: "published",
        published_to_website_id: websiteId,
        published_url: result.url,
        wp_post_id: result.postId?.toString(),
        published_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    await supabase
      .from("article_jobs")
      .update({
        status: "published",
        website_id: websiteId,
        published_at: new Date().toISOString(),
        wp_post_id: result.postId?.toString(),
      })
      .eq("id", articleJobId);

    revalidatePath("/dashboard/articles/manage");
    return { success: true, error: null, url: result.url };
  } catch (err) {
    console.error("Publish error:", err);
    return { success: false, error: "發布過程發生錯誤" };
  }
}

export async function deleteArticle(articleJobId: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  await supabase
    .from("generated_articles")
    .delete()
    .eq("article_job_id", articleJobId);

  const { error } = await supabase
    .from("article_jobs")
    .delete()
    .eq("id", articleJobId);

  if (error) {
    console.error("Failed to delete article:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/articles/manage");
  return { success: true, error: null };
}
