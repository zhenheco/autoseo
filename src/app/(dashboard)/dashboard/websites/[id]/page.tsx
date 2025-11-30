import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { checkPagePermission } from "@/lib/permissions";
import { ArrowLeft, ExternalLink, FileText, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WebsiteArticleManager } from "./components/WebsiteArticleManager";

export const dynamic = "force-dynamic";

interface Article {
  id: string;
  title: string;
  html_content: string | null;
  markdown_content: string | null;
  status: string;
  word_count: number | null;
  reading_time: number | null;
  focus_keyword: string | null;
  seo_title: string | null;
  seo_description: string | null;
  featured_image_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  wordpress_post_url: string | null;
}

interface ArticleJob {
  id: string;
  keywords: string[] | null;
  status: string;
  progress: number | null;
  current_step: string | null;
  created_at: string;
  metadata: { title?: string } | null;
}

async function getWebsite(websiteId: string, companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("website_configs")
    .select("*")
    .eq("id", websiteId)
    .eq("company_id", companyId)
    .single();

  if (error) {
    console.error("Error fetching website:", error);
    return null;
  }

  return data;
}

async function getWebsiteArticles(
  websiteId: string,
  companyId: string,
): Promise<Article[]> {
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
    .eq("website_id", websiteId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching articles:", error);
    return [];
  }

  return (data || []) as Article[];
}

async function getWebsiteArticleJobs(
  websiteId: string,
  companyId: string,
): Promise<ArticleJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("article_jobs")
    .select(
      "id, keywords, status, progress, current_step, created_at, metadata",
    )
    .eq("website_id", websiteId)
    .eq("company_id", companyId)
    .in("status", ["pending", "processing", "scheduled"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching article jobs:", error);
    return [];
  }

  return (data || []) as ArticleJob[];
}

export default async function WebsiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("canAccessWebsites");

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const company = await getUserPrimaryCompany(user.id);
  if (!company) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const website = await getWebsite(id, company.id);

  if (!website) {
    redirect("/dashboard/websites?error=網站不存在或無權訪問");
  }

  const [articles, jobs] = await Promise.all([
    getWebsiteArticles(id, company.id),
    getWebsiteArticleJobs(id, company.id),
  ]);

  const publishedCount = articles.filter(
    (a) => a.status === "published",
  ).length;
  const pendingCount = articles.filter((a) => a.status !== "published").length;
  const totalWords = articles.reduce((sum, a) => sum + (a.word_count || 0), 0);
  const totalArticles = articles.length + jobs.length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/websites">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回網站列表
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {website.site_name || website.website_name}
              </h1>
              <a
                href={website.site_url || website.wordpress_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                {website.site_url || website.wordpress_url}
                <ExternalLink className="h-3 w-3" />
              </a>
              <Badge variant={website.is_active ? "default" : "secondary"}>
                {website.is_active ? "啟用中" : "已停用"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mt-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalArticles}</p>
                <p className="text-sm text-muted-foreground">總文章數</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {pendingCount + jobs.length}
                </p>
                <p className="text-sm text-muted-foreground">待發佈</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <ExternalLink className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{publishedCount}</p>
                <p className="text-sm text-muted-foreground">已發佈</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {totalWords.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">總字數</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <WebsiteArticleManager
          initialArticles={articles}
          initialJobs={jobs}
          websiteId={id}
          companyId={company.id}
        />
      </div>
    </div>
  );
}
