import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArticleManager } from "./components/ArticleManager";

export const dynamic = "force-dynamic";

interface ArticleJob {
  id: string;
  keywords: string[] | null;
  status: string;
  progress: number | null;
  current_step: string | null;
  created_at: string;
  metadata: { title?: string } | null;
}

async function getArticles(companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      title,
      html_content,
      markdown_content,
      status,
      word_count,
      reading_time,
      focus_keyword,
      seo_title,
      seo_description,
      featured_image_url,
      created_at,
      updated_at,
      published_at,
      wordpress_post_url
    `,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching articles:", error);
    return [];
  }

  return data || [];
}

async function getArticleJobs(companyId: string): Promise<ArticleJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("article_jobs")
    .select(
      "id, keywords, status, progress, current_step, created_at, metadata",
    )
    .eq("company_id", companyId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching article jobs:", error);
    return [];
  }

  return (data || []) as ArticleJob[];
}

async function getCompanyId(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return data?.company_id;
}

export default async function ArticleManagePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const companyId = await getCompanyId(user.id);

  if (!companyId) {
    redirect("/dashboard?error=no-company");
  }

  const [articles, jobs] = await Promise.all([
    getArticles(companyId),
    getArticleJobs(companyId),
  ]);

  return (
    <ArticleManager
      initialArticles={articles}
      initialJobs={jobs}
      companyId={companyId}
    />
  );
}
