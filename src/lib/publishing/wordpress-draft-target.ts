import { WordPressClient, type WordPressConfig } from "@/lib/wordpress/client";
import { resolveWordPressApplicationPassword } from "./wordpress-credentials";

interface WordPressDraftSupabase {
  from(table: string): any;
}

interface WordPressDraftArticleJob {
  id: string;
}

interface WordPressDraftGeneratedArticle {
  id: string;
  wordpress_post_id: number;
}

interface WordPressDraftWebsite {
  id: string;
  wordpress_url: string;
  wp_username?: string | null;
  wp_app_password?: string | null;
  wordpress_access_token?: string | null;
  wordpress_refresh_token?: string | null;
}

interface WordPressDraftClient {
  updatePost(id: number, data: { status: "publish" }): Promise<unknown>;
}

interface WordPressDraftDependencies {
  createWordPressClient?: (config: WordPressConfig) => WordPressDraftClient;
  resolvePassword?: (storedPassword: string | null | undefined) => string;
  now?: () => string;
}

interface PublishWordPressDraftArticleInput {
  supabase: WordPressDraftSupabase;
  article: WordPressDraftArticleJob;
  generatedArticle: WordPressDraftGeneratedArticle;
  website: WordPressDraftWebsite;
  dependencies?: WordPressDraftDependencies;
}

export async function publishWordPressDraftArticle({
  supabase,
  article,
  generatedArticle,
  website,
  dependencies = {},
}: PublishWordPressDraftArticleInput) {
  const resolvePassword =
    dependencies.resolvePassword ?? resolveWordPressApplicationPassword;
  const createWordPressClient =
    dependencies.createWordPressClient ??
    ((config: WordPressConfig) => new WordPressClient(config));
  const now = dependencies.now ?? (() => new Date().toISOString());

  const wordpressPostId = generatedArticle.wordpress_post_id;
  const wordpressClient = createWordPressClient({
    url: website.wordpress_url,
    username: website.wp_username || "",
    applicationPassword: resolvePassword(website.wp_app_password),
    accessToken: website.wordpress_access_token || undefined,
    refreshToken: website.wordpress_refresh_token || undefined,
  });

  await wordpressClient.updatePost(wordpressPostId, { status: "publish" });

  const publishedAt = now();

  const jobResult = await supabase
    .from("article_jobs")
    .update({
      status: "published",
      published_at: publishedAt,
      wordpress_post_id: wordpressPostId.toString(),
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
      wordpress_status: "publish",
      published_at: publishedAt,
      status: "published",
      published_to_website_id: website.id,
      published_to_website_at: publishedAt,
    })
    .eq("id", generatedArticle.id);

  if (articleResult.error) {
    throw new Error(
      articleResult.error.message ?? "Generated article update failed",
    );
  }

  return { publishedAt, wordpressPostId };
}
