import { getUser } from "@/lib/auth";
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
import { ArticleDetailPublish } from "./components/ArticleDetailPublish";
import { SocialShareDialog } from "@/components/social/SocialShareDialog";
import { getTranslations } from "next-intl/server";

async function getArticle(articleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("article_jobs")
    .select(
      `
      *,
      website_configs (
        site_name,
        site_url
      ),
      generated_articles (
        id,
        title,
        html_content,
        markdown_content,
        word_count,
        seo_title,
        seo_description,
        featured_image_url
      )
    `,
    )
    .eq("id", articleId)
    .single();

  if (error) throw error;

  return data;
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  const t = await getTranslations("articles.detail");

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    redirect("/dashboard/articles?error=" + encodeURIComponent(t("notFound")));
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {article.generated_articles?.title ||
              article.article_title ||
              t("untitled")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("websiteLabel")} {article.website_configs?.site_name || t("unspecified")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/articles/manage">
            <Button variant="outline">{t("backToList")}</Button>
          </Link>
          {(article.status === "completed" || article.status === "draft") && (
            <ArticleDetailPublish
              articleId={article.id}
              currentWebsiteId={article.website_id}
            />
          )}
          {(article.status === "completed" || article.status === "published") &&
            article.generated_articles?.id && (
              <SocialShareDialog
                articleId={article.generated_articles.id}
                articleTitle={
                  article.generated_articles?.title ||
                  article.article_title ||
                  t("untitled")
                }
                featuredImageUrl={
                  article.generated_articles?.featured_image_url || undefined
                }
              />
            )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* 文章資訊 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("articleInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("statusLabel")}</span>
              <span
                className={`text-sm px-3 py-1 rounded-full ${
                  article.status === "published"
                    ? "bg-green-100 text-green-700"
                    : article.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : article.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-foreground"
                }`}
              >
                {article.status === "published" && t("statusPublished")}
                {article.status === "failed" && t("statusFailed")}
                {article.status === "processing" && t("statusProcessing")}
                {article.status === "draft" && t("statusDraft")}
                {article.status === "pending" && t("statusPending")}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("inputMethod")}</span>
              <span>
                {article.input_type === "keyword" && t("inputTypeKeyword")}
                {article.input_type === "url" && t("inputTypeUrl")}
                {article.input_type === "batch" && t("inputTypeBatch")}
              </span>
            </div>

            {article.input_content && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("inputContent")}</span>
                <span className="text-sm">
                  {article.input_content.keyword &&
                    article.input_content.keyword}
                  {article.input_content.url && (
                    <a
                      href={article.input_content.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {article.input_content.url}
                    </a>
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("createdAt")}</span>
              <span className="text-sm">
                {new Date(article.created_at).toLocaleString()}
              </span>
            </div>

            {article.published_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("publishedAt")}</span>
                <span className="text-sm">
                  {new Date(article.published_at).toLocaleString()}
                </span>
              </div>
            )}

            {article.wp_post_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">WordPress ID</span>
                <span className="text-sm">{article.wp_post_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 文章內容 */}
        {article.generated_articles && (
          <Card>
            <CardHeader>
              <CardTitle>{t("generatedContent")}</CardTitle>
              <CardDescription>{t("generatedContentDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                {article.generated_articles.title && (
                  <h2 className="text-2xl font-bold mb-4">
                    {article.generated_articles.title}
                  </h2>
                )}
                {article.generated_articles.html_content && (
                  <div
                    className="prose prose-lg max-w-none prose-p:leading-[1.8] prose-p:my-5 prose-h2:mt-10 prose-h2:mb-4 prose-h3:mt-7 prose-h3:mb-3 prose-li:my-2 prose-li:leading-[1.7] prose-ul:my-6 prose-ol:my-6 prose-img:my-8"
                    dangerouslySetInnerHTML={{
                      __html: article.generated_articles.html_content,
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 錯誤訊息 */}
        {article.error_message && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">{t("errorMessage")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">
                {article.error_message}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
