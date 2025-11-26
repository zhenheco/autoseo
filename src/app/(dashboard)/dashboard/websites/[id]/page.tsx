import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { checkPagePermission } from "@/lib/permissions";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Clock,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface Article {
  id: string;
  title: string | null;
  slug: string | null;
  status: string;
  quality_score: number | null;
  word_count: number | null;
  reading_time: number | null;
  wordpress_post_url: string | null;
  created_at: string;
  published_at: string | null;
  published_to_website_at: string | null;
  excerpt: string | null;
  keywords: string[] | null;
  article_job?: {
    scheduled_publish_at: string | null;
    auto_publish: boolean | null;
    status: string | null;
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

async function getWebsiteArticles(websiteId: string, companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      title,
      slug,
      status,
      quality_score,
      word_count,
      reading_time,
      wordpress_post_url,
      created_at,
      published_at,
      published_to_website_at,
      excerpt,
      keywords,
      article_job:article_jobs(scheduled_publish_at, auto_publish, status)
    `,
    )
    .eq("published_to_website_id", websiteId)
    .eq("company_id", companyId)
    .order("published_to_website_at", { ascending: false });

  if (error) {
    console.error("Error fetching articles:", error);
    return [];
  }

  const articles = (data || []).map((article) => ({
    ...article,
    article_job:
      Array.isArray(article.article_job) && article.article_job.length > 0
        ? article.article_job[0]
        : null,
  }));

  return articles as Article[];
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScheduleTime(dateString: string) {
  const date = new Date(dateString);
  return date
    .toLocaleDateString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/\//g, "/");
}

function getStatusBadge(status: string) {
  const statusMap: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    generated: { label: "已生成", variant: "secondary" },
    reviewed: { label: "已審核", variant: "default" },
    published: { label: "已發布", variant: "default" },
    archived: { label: "已封存", variant: "outline" },
  };

  const config = statusMap[status] || { label: status, variant: "secondary" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
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

  const articles = await getWebsiteArticles(id, company.id);

  const publishedArticlesList = articles.filter(
    (a) => a.status === "published",
  );
  const pendingArticlesList = articles.filter((a) => a.status !== "published");

  const totalArticles = articles.length;
  const publishedCount = publishedArticlesList.length;
  const pendingCount = pendingArticlesList.length;
  const totalWords = articles.reduce((sum, a) => sum + (a.word_count || 0), 0);

  return (
    <div className="container mx-auto p-8">
      {/* 返回按鈕 */}
      <Link href="/dashboard/websites">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回網站列表
        </Button>
      </Link>

      {/* 網站資訊卡片 */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">
                {website.site_name || website.website_name}
              </CardTitle>
              <CardDescription className="mt-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <a
                  href={website.site_url || website.wordpress_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {website.site_url || website.wordpress_url}
                </a>
              </CardDescription>
            </div>
            <Badge variant={website.is_active ? "default" : "secondary"}>
              {website.is_active ? "啟用中" : "已停用"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalArticles}</p>
                <p className="text-sm text-muted-foreground">總文章數</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">待發佈</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ExternalLink className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{publishedCount}</p>
                <p className="text-sm text-muted-foreground">已發佈</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {totalWords.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">總字數</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 文章區塊 - 左右兩欄 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左側 - 待發佈文章 */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              待發佈文章
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              排定發佈到此網站但尚在等候中的文章
            </p>
          </div>

          {pendingArticlesList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">目前沒有待發佈的文章</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pendingArticlesList.map((article) => (
                <Card
                  key={article.id}
                  className="hover:shadow-md transition-shadow border-orange-200"
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">
                          {article.title || "未命名文章"}
                        </CardTitle>
                        {article.excerpt && (
                          <CardDescription className="mt-1 line-clamp-2 text-xs">
                            {article.excerpt}
                          </CardDescription>
                        )}
                        {article.keywords && article.keywords.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {article.keywords
                              .slice(0, 3)
                              .map((keyword, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs py-0 h-5"
                                >
                                  {keyword}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {article.article_job?.scheduled_publish_at && (
                          <Badge
                            variant="outline"
                            className="text-xs whitespace-nowrap bg-orange-50"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            {formatScheduleTime(
                              article.article_job.scheduled_publish_at,
                            )}
                          </Badge>
                        )}
                        {getStatusBadge(article.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        <span>
                          {article.word_count?.toLocaleString() || 0} 字
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>{formatScheduleTime(article.created_at)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 右側 - 已發佈文章 */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-green-600" />
              已發佈文章
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              已發佈到此網站的文章存檔
            </p>
          </div>

          {publishedArticlesList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">此網站尚無已發佈的文章</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {publishedArticlesList.map((article) => (
                <Card
                  key={article.id}
                  className="hover:shadow-md transition-shadow border-green-200"
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">
                          {article.title || "未命名文章"}
                        </CardTitle>
                        {article.excerpt && (
                          <CardDescription className="mt-1 line-clamp-2 text-xs">
                            {article.excerpt}
                          </CardDescription>
                        )}
                        {article.keywords && article.keywords.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {article.keywords
                              .slice(0, 3)
                              .map((keyword, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs py-0 h-5"
                                >
                                  {keyword}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(article.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3" />
                          <span>
                            {article.word_count?.toLocaleString() || 0} 字
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {article.published_to_website_at
                              ? formatScheduleTime(
                                  article.published_to_website_at,
                                )
                              : formatScheduleTime(article.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {article.wordpress_post_url && (
                          <a
                            href={article.wordpress_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                            >
                              <ExternalLink className="mr-1.5 h-3 w-3" />
                              查看
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
