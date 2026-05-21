import { getUser } from "@shared/auth";
import { redirect } from "next/navigation";
import { createClient } from "@shared/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import Link from "next/link";
import { ArticleDetailPublish } from "./components/ArticleDetailPublish";
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

async function getArticleCardAssets(articleId?: string) {
  if (!articleId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("article_assets")
    .select("id, template, size, r2_url, created_at")
    .eq("article_id", articleId)
    .eq("kind", "card")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
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
  const generatedArticle = Array.isArray(article?.generated_articles)
    ? article.generated_articles[0]
    : article?.generated_articles;
  const cardAssets = await getArticleCardAssets(generatedArticle?.id);

  if (!article) {
    redirect("/dashboard/articles?error=" + encodeURIComponent(t("notFound")));
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {generatedArticle?.title || article.article_title || t("untitled")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("websiteLabel")}{" "}
            {article.website_configs?.site_name || t("unspecified")}
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
                <span className="text-muted-foreground">
                  {t("inputContent")}
                </span>
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
                <span className="text-muted-foreground">
                  {t("publishedAt")}
                </span>
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
        {generatedArticle && (
          <Card>
            <CardHeader>
              <CardTitle>{t("generatedContent")}</CardTitle>
              <CardDescription>
                {t("generatedContentDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                {generatedArticle.title && (
                  <h2 className="text-2xl font-bold mb-4">
                    {generatedArticle.title}
                  </h2>
                )}
                {generatedArticle.html_content && (
                  <div
                    className="prose prose-lg max-w-none prose-p:leading-[1.8] prose-p:my-5 prose-h2:mt-10 prose-h2:mb-4 prose-h3:mt-7 prose-h3:mb-3 prose-li:my-2 prose-li:leading-[1.7] prose-ul:my-6 prose-ol:my-6 prose-img:my-8"
                    dangerouslySetInnerHTML={{
                      __html: generatedArticle.html_content,
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {cardAssets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("cardAssets")}</CardTitle>
              <CardDescription>{t("cardAssetsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cardAssets.map((asset) => {
                  const displayUrl = resolveCardDisplayUrl(asset.r2_url);
                  const label = [asset.template, asset.size]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div
                      key={asset.id}
                      className="overflow-hidden rounded-lg border bg-background"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- card URLs can point at tenant R2 public domains not configured for next/image. */}
                      <img
                        src={displayUrl}
                        alt={label}
                        className="aspect-video w-full bg-muted object-cover"
                      />
                      <div className="flex items-center justify-between gap-3 p-3">
                        <span className="truncate text-sm text-muted-foreground">
                          {label}
                        </span>
                        <a
                          href={displayUrl}
                          download
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {t("downloadCard")}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 錯誤訊息 */}
        {article.error_message && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">
                {t("errorMessage")}
              </CardTitle>
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

function resolveCardDisplayUrl(r2Url: string): string {
  if (!r2Url.startsWith("r2://")) return r2Url;

  const [, rest] = r2Url.split("r2://");
  const slashIndex = rest.indexOf("/");
  const key = slashIndex >= 0 ? rest.slice(slashIndex + 1) : "";
  const publicBase =
    process.env.CARD_ASSETS_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_CARD_ASSETS_PUBLIC_URL ??
    (process.env.R2_ACCOUNT_ID
      ? `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`
      : null);

  return publicBase && key ? `${publicBase.replace(/\/+$/, "")}/${key}` : r2Url;
}
