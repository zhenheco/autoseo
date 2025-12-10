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
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

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

// 從 article_jobs 查詢的結果類型
interface ArticleJobWithContent {
  id: string;
  status: string;
  progress: number | null;
  current_step: string | null;
  keywords: string[] | null;
  metadata: { title?: string } | null;
  created_at: string;
  published_at: string | null;
  // UNIQUE 約束導致 Supabase 返回對象而非陣列
  generated_articles: {
    id: string;
    title: string;
    html_content: string | null;
    markdown_content: string | null;
    word_count: number | null;
    reading_time: number | null;
    focus_keyword: string | null;
    seo_title: string | null;
    seo_description: string | null;
    featured_image_url: string | null;
    updated_at: string;
    wordpress_post_url: string | null;
  } | null;
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

// 統一從 article_jobs 查詢（與文章列表頁面一致）
async function getWebsiteArticlesFromJobs(
  websiteId: string,
  companyId: string,
): Promise<{ articles: Article[]; jobs: ArticleJob[] }> {
  const supabase = await createClient();

  // 從 article_jobs 查詢，JOIN generated_articles
  const { data, error } = await supabase
    .from("article_jobs")
    .select(
      `
      id,
      status,
      progress,
      current_step,
      keywords,
      metadata,
      created_at,
      published_at,
      generated_articles (
        id,
        title,
        html_content,
        markdown_content,
        word_count,
        reading_time,
        focus_keyword,
        seo_title,
        seo_description,
        featured_image_url,
        updated_at,
        wordpress_post_url
      )
    `,
    )
    .eq("website_id", websiteId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching articles from jobs:", error);
    return { articles: [], jobs: [] };
  }

  // UNIQUE 約束導致 Supabase 返回對象而非陣列，需要先轉為 unknown
  const jobsData = (data || []) as unknown as ArticleJobWithContent[];

  // 分離已完成的文章和進行中的任務
  const articles: Article[] = [];
  const jobs: ArticleJob[] = [];

  for (const job of jobsData) {
    // 正在處理中的任務 → 顯示為 job（帶進度）
    if (job.status === "pending" || job.status === "processing") {
      jobs.push({
        id: job.id,
        keywords: job.keywords,
        status: job.status,
        progress: job.progress,
        current_step: job.current_step,
        created_at: job.created_at,
        metadata: job.metadata,
      });
    } else {
      // 其他狀態（completed/scheduled/published/failed 等）→ 顯示為文章
      const ga = job.generated_articles;
      articles.push({
        id: ga?.id || job.id, // 如果沒有 GA，用 job.id
        title: ga?.title || job.keywords?.join(", ") || "未命名文章",
        html_content: ga?.html_content || null,
        markdown_content: ga?.markdown_content || null,
        status: job.status,
        word_count: ga?.word_count || null,
        reading_time: ga?.reading_time || null,
        focus_keyword: ga?.focus_keyword || job.keywords?.[0] || null,
        seo_title: ga?.seo_title || null,
        seo_description: ga?.seo_description || null,
        featured_image_url: ga?.featured_image_url || null,
        created_at: job.created_at,
        updated_at: ga?.updated_at || job.created_at,
        published_at: job.published_at,
        wordpress_post_url: ga?.wordpress_post_url || null,
      });
    }
  }

  return { articles, jobs };
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

  // 統一從 article_jobs 查詢（與文章列表頁面一致）
  const { articles, jobs } = await getWebsiteArticlesFromJobs(id, company.id);

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

        {/* 分析儀表板 - GSC 和 GA4 */}
        <div className="mt-4">
          <AnalyticsDashboard websiteId={id} />
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
