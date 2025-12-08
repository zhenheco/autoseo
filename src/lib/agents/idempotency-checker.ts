import { createAdminClient } from "@/lib/supabase/server";

export interface IdempotencyConfig {
  timeWindowDays: number;
  forceRegenerate?: boolean;
}

export interface IdempotencyResult {
  isDuplicate: boolean;
  existingArticleId?: string;
  existingJobId?: string;
  message: string;
  createdAt?: string;
}

const DEFAULT_CONFIG: IdempotencyConfig = {
  timeWindowDays: 30,
  forceRegenerate: false,
};

export function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

export async function checkIdempotency(
  websiteId: string,
  keyword: string,
  config: Partial<IdempotencyConfig> = {},
): Promise<IdempotencyResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (finalConfig.forceRegenerate) {
    return {
      isDuplicate: false,
      message: "Force regenerate enabled, skipping idempotency check",
    };
  }

  const normalizedKeyword = normalizeKeyword(keyword);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - finalConfig.timeWindowDays);

  try {
    const supabase = createAdminClient();

    const { data: existingArticle, error: articleError } = await supabase
      .from("generated_articles")
      .select("id, keyword, created_at")
      .eq("website_id", websiteId)
      .gte("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (articleError) {
      console.error(
        "[IdempotencyChecker] Failed to check articles:",
        articleError,
      );
      return {
        isDuplicate: false,
        message:
          "Failed to check existing articles, proceeding with generation",
      };
    }

    const matchingArticle = existingArticle?.find(
      (article) =>
        normalizeKeyword(article.keyword || "") === normalizedKeyword,
    );

    if (matchingArticle) {
      return {
        isDuplicate: true,
        existingArticleId: matchingArticle.id,
        message: `Duplicate found: Article for "${keyword}" already exists (created: ${matchingArticle.created_at})`,
        createdAt: matchingArticle.created_at,
      };
    }

    const { data: existingJob, error: jobError } = await supabase
      .from("article_jobs")
      .select("id, keyword, status, created_at")
      .eq("website_id", websiteId)
      .in("status", ["pending", "processing"])
      .gte("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (jobError) {
      console.error("[IdempotencyChecker] Failed to check jobs:", jobError);
      return {
        isDuplicate: false,
        message: "Failed to check existing jobs, proceeding with generation",
      };
    }

    const matchingJob = existingJob?.find(
      (job) => normalizeKeyword(job.keyword || "") === normalizedKeyword,
    );

    if (matchingJob) {
      return {
        isDuplicate: true,
        existingJobId: matchingJob.id,
        message: `Duplicate found: Job for "${keyword}" is ${matchingJob.status} (created: ${matchingJob.created_at})`,
        createdAt: matchingJob.created_at,
      };
    }

    return {
      isDuplicate: false,
      message: `No duplicate found for "${keyword}" within ${finalConfig.timeWindowDays} days`,
    };
  } catch (err) {
    console.error("[IdempotencyChecker] Error:", err);
    return {
      isDuplicate: false,
      message: "Idempotency check failed, proceeding with generation",
    };
  }
}

export async function getExistingArticle(
  websiteId: string,
  keyword: string,
): Promise<{
  id: string;
  title: string;
  slug: string;
  html_content: string;
  created_at: string;
} | null> {
  const normalizedKeyword = normalizeKeyword(keyword);

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("generated_articles")
      .select("id, title, slug, html_content, keyword, created_at")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[IdempotencyChecker] Failed to get article:", error);
      return null;
    }

    const match = data?.find(
      (article) =>
        normalizeKeyword(article.keyword || "") === normalizedKeyword,
    );

    if (match) {
      return {
        id: match.id,
        title: match.title,
        slug: match.slug,
        html_content: match.html_content,
        created_at: match.created_at,
      };
    }

    return null;
  } catch (err) {
    console.error("[IdempotencyChecker] Error:", err);
    return null;
  }
}
