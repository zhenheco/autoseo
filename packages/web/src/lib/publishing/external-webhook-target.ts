type SyncArticle = typeof import("@/lib/sync").syncArticle;

interface ExternalWebhookSupabase {
  from(table: string): any;
}

interface ExternalWebhookArticleJob {
  id: string;
}

interface ExternalWebhookGeneratedArticle {
  id: string;
}

interface ExternalWebhookWebsite {
  id: string;
}

interface PublishExternalWebhookArticleInput {
  supabase: ExternalWebhookSupabase;
  syncArticle: SyncArticle;
  article: ExternalWebhookArticleJob;
  generatedArticle: ExternalWebhookGeneratedArticle;
  website: ExternalWebhookWebsite;
  now?: () => string;
}

export async function publishExternalWebhookArticle({
  supabase,
  syncArticle,
  article,
  generatedArticle,
  website,
  now = () => new Date().toISOString(),
}: PublishExternalWebhookArticleInput) {
  const { data: fullArticle, error: fullArticleError } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("id", generatedArticle.id)
    .single();

  if (fullArticleError) {
    throw new Error(fullArticleError.message ?? "無法取得完整文章資料");
  }

  if (!fullArticle) {
    throw new Error("無法取得完整文章資料");
  }

  const syncResult = await syncArticle(
    fullArticle as Parameters<SyncArticle>[0],
    "create",
    [website.id],
  );

  if (syncResult.failed > 0) {
    const failedResult = syncResult.results.find((result) => !result.success);
    throw new Error(failedResult?.error_message || "同步失敗");
  }

  const publishedAt = now();

  const jobResult = await supabase
    .from("article_jobs")
    .update({
      status: "published",
      published_at: publishedAt,
      publish_retry_count: 0,
      last_publish_error: null,
    })
    .eq("id", article.id);

  if (jobResult.error) {
    throw new Error(jobResult.error.message ?? "Article job update failed");
  }

  const articleResult = await supabase
    .from("generated_articles")
    .update({
      status: "published",
      published_at: publishedAt,
      published_to_website_id: website.id,
      published_to_website_at: publishedAt,
    })
    .eq("id", generatedArticle.id);

  if (articleResult.error) {
    throw new Error(
      articleResult.error.message ?? "Generated article update failed",
    );
  }

  return { publishedAt, fullArticle };
}
