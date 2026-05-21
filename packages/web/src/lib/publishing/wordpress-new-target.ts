import { WordPressClient, type WordPressConfig } from "@/lib/wordpress/client";
import { resolveWordPressApplicationPassword } from "./wordpress-credentials";

interface WordPressNewSupabase {
  from(table: string): any;
}

interface WordPressNewArticleJob {
  id: string;
}

interface WordPressNewGeneratedArticle {
  id: string;
  title: string;
  html_content?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  slug?: string | null;
  og_image?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  focus_keyword?: string | null;
}

interface WordPressNewWebsite {
  id: string;
  wordpress_url: string;
  wp_username?: string | null;
  wp_app_password?: string | null;
  wordpress_access_token?: string | null;
  wordpress_refresh_token?: string | null;
}

interface WordPressNewClient {
  publishArticle(
    article: {
      title: string;
      content: string;
      excerpt: string;
      slug: string;
      featuredImageUrl?: string;
      categories: string[];
      tags: string[];
      seoTitle: string;
      seoDescription: string;
      focusKeyword: string;
    },
    status: "publish",
  ): Promise<{
    post: {
      id?: number | null;
      link?: string | null;
      status?: string | null;
    };
  }>;
}

interface WordPressNewDependencies {
  createWordPressClient?: (config: WordPressConfig) => WordPressNewClient;
  resolvePassword?: (storedPassword: string | null | undefined) => string;
  now?: () => string;
}

interface PublishNewWordPressArticleInput {
  supabase: WordPressNewSupabase;
  article: WordPressNewArticleJob;
  generatedArticle: WordPressNewGeneratedArticle;
  website: WordPressNewWebsite;
  dependencies?: WordPressNewDependencies;
}

export async function publishNewWordPressArticle({
  supabase,
  article,
  generatedArticle,
  website,
  dependencies = {},
}: PublishNewWordPressArticleInput) {
  const resolvePassword =
    dependencies.resolvePassword ?? resolveWordPressApplicationPassword;
  const createWordPressClient =
    dependencies.createWordPressClient ??
    ((config: WordPressConfig) => new WordPressClient(config));
  const now = dependencies.now ?? (() => new Date().toISOString());

  const wordpressClient = createWordPressClient({
    url: website.wordpress_url,
    username: website.wp_username || "",
    applicationPassword: resolvePassword(website.wp_app_password),
    accessToken: website.wordpress_access_token || undefined,
    refreshToken: website.wordpress_refresh_token || undefined,
  });

  const title = generatedArticle.seo_title || generatedArticle.title;
  const seoDescription = generatedArticle.seo_description || "";
  const publishResult = await wordpressClient.publishArticle(
    {
      title,
      content: generatedArticle.html_content || "",
      excerpt: seoDescription,
      slug: generatedArticle.slug || "",
      featuredImageUrl: generatedArticle.og_image || undefined,
      categories: generatedArticle.categories || [],
      tags: generatedArticle.tags || [],
      seoTitle: title,
      seoDescription,
      focusKeyword: generatedArticle.focus_keyword || "",
    },
    "publish",
  );

  const publishedAt = now();
  const wordpressPostId = publishResult.post.id;

  const jobResult = await supabase
    .from("article_jobs")
    .update({
      status: "published",
      published_at: publishedAt,
      wordpress_post_id: wordpressPostId?.toString(),
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
      wordpress_post_id: wordpressPostId,
      wordpress_post_url: publishResult.post.link,
      wordpress_status: publishResult.post.status,
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
