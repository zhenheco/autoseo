interface PlatformBlogUpdateResult {
  error?: { message?: string } | null;
}

type PlatformBlogUpdateQuery = PromiseLike<PlatformBlogUpdateResult>;

interface PlatformBlogSupabase {
  from(table: "article_jobs" | "generated_articles"): {
    update(values: Record<string, unknown>): {
      eq(column: "id", value: string): PlatformBlogUpdateQuery;
    };
  };
}

interface PlatformBlogArticleJob {
  id: string;
}

interface PlatformBlogGeneratedArticle {
  id: string;
}

interface PlatformBlogWebsite {
  id: string;
}

interface PublishPlatformBlogArticleInput {
  supabase: PlatformBlogSupabase;
  article: PlatformBlogArticleJob;
  generatedArticle: PlatformBlogGeneratedArticle;
  website: PlatformBlogWebsite;
  now?: () => string;
}

export async function publishPlatformBlogArticle({
  supabase,
  article,
  generatedArticle,
  website,
  now = () => new Date().toISOString(),
}: PublishPlatformBlogArticleInput) {
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

  return { publishedAt };
}
