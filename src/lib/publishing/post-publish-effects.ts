type SyncArticle = typeof import("@/lib/sync").syncArticle;

interface PostPublishSupabase {
  from(table: string): any;
}

interface PostPublishArticleJob {
  id: string;
  company_id: string;
  user_id: string;
  sync_target_ids?: string[] | null;
}

interface PostPublishGeneratedArticle {
  id: string;
}

interface PostPublishWebsite {
  id: string;
  auto_translate_enabled?: boolean | null;
  auto_translate_languages?: string[] | null;
}

type TriggerAutoTranslation = (
  supabase: any,
  articleId: string,
  websiteId: string,
  companyId: string,
  userId: string,
  autoTranslateEnabled: boolean | null,
  autoTranslateLanguages: string[] | null,
) => Promise<unknown>;

interface RunScheduledPostPublishEffectsInput {
  supabase: PostPublishSupabase;
  article: PostPublishArticleJob;
  generatedArticle: PostPublishGeneratedArticle;
  website: PostPublishWebsite;
  triggerAutoTranslation: TriggerAutoTranslation;
  loadSyncArticle?: () => Promise<SyncArticle>;
  logSyncError?: (message: string, error: unknown) => void;
}

export async function runScheduledPostPublishEffects({
  supabase,
  article,
  generatedArticle,
  website,
  triggerAutoTranslation,
  loadSyncArticle = async () => {
    const { syncArticle } = await import("@/lib/sync");
    return syncArticle;
  },
  logSyncError = console.error,
}: RunScheduledPostPublishEffectsInput) {
  const autoTranslation = await triggerAutoTranslation(
    supabase,
    generatedArticle.id,
    website.id,
    article.company_id,
    article.user_id,
    website.auto_translate_enabled ?? null,
    website.auto_translate_languages ?? null,
  );

  const syncTargetIds = article.sync_target_ids;
  if (!syncTargetIds || syncTargetIds.length === 0) {
    return { autoTranslation, syncQueued: false };
  }

  const { data: fullArticle } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("id", generatedArticle.id)
    .single();

  if (!fullArticle) {
    return { autoTranslation, syncQueued: false };
  }

  const syncArticle = await loadSyncArticle();
  syncArticle(
    fullArticle as Parameters<SyncArticle>[0],
    "create",
    syncTargetIds,
  ).catch((error) => {
    logSyncError(
      `[Process Scheduled Articles] Sync failed for ${article.id}:`,
      error,
    );
  });

  return { autoTranslation, syncQueued: true };
}
