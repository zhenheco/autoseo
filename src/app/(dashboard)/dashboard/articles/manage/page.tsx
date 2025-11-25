import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArticleManager } from "./components/ArticleManager";

export const dynamic = "force-dynamic";

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

  const articles = await getArticles(companyId);

  return <ArticleManager initialArticles={articles} />;
}
