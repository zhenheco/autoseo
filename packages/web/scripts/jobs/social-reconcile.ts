#!/usr/bin/env tsx

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  createSocialPublisher,
  type SocialEngagement,
  type SocialPublisher,
} from "../../src/lib/social/publisher";

type SupabaseLike = {
  from(table: string): unknown;
};

type Logger = Pick<Console, "log" | "warn" | "error">;

export type PublishedSocialPostRow = {
  id: string;
  platform_post_id: string | null;
  status: string;
  published_at: string | null;
  metrics: unknown;
  metrics_updated_at: string | null;
};

type SocialPostsQueryBuilder = {
  select(columns: string): SocialPostsQueryBuilder;
  eq(column: string, value: unknown): SocialPostsQueryBuilder;
  gte(column: string, value: string): SocialPostsQueryBuilder;
  not(
    column: string,
    operator: string,
    value: unknown,
  ): SocialPostsQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): SocialPostsQueryBuilder;
  limit(value: number): PromiseLike<{
    data: PublishedSocialPostRow[] | null;
    error: { message?: string } | null;
  }>;
};

type SocialPostsUpdateBuilder = {
  update(payload: Record<string, unknown>): {
    eq(
      column: string,
      value: string,
    ): PromiseLike<{ data?: unknown; error: { message?: string } | null }>;
  };
};

export type SocialReconcileJobResult = {
  scanned: number;
  updated: number;
  failed: number;
  errors: string[];
};

function requireProductionSupabase() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function loadPublishedPosts(
  supabase: SupabaseLike,
  now: Date,
): Promise<PublishedSocialPostRow[]> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const builder = supabase.from("social_posts") as SocialPostsQueryBuilder;
  const { data, error } = await builder
    .select(
      "id, platform_post_id, status, published_at, metrics, metrics_updated_at",
    )
    .eq("status", "published")
    .gte("published_at", since)
    .not("platform_post_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message || "social_reconcile_posts_query_failed");
  }

  return data ?? [];
}

async function updateMetrics(input: {
  supabase: SupabaseLike;
  rowId: string;
  metrics: SocialEngagement;
  now: Date;
}) {
  const builder = input.supabase.from(
    "social_posts",
  ) as SocialPostsUpdateBuilder;
  const { error } = await builder
    .update({
      metrics: input.metrics,
      metrics_updated_at: input.now.toISOString(),
    })
    .eq("id", input.rowId);

  if (error) {
    throw new Error(error.message || "social_reconcile_metrics_update_failed");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runSocialReconcileJob(
  input: {
    now?: Date;
    supabase?: SupabaseLike;
    publisher?: Pick<SocialPublisher, "fetchEngagement">;
    logger?: Logger;
  } = {},
): Promise<SocialReconcileJobResult> {
  const now = input.now ?? new Date();
  const logger = input.logger ?? console;
  const supabase = input.supabase ?? requireProductionSupabase();
  const publisher =
    input.publisher ?? createSocialPublisher({ supabase: supabase as never });
  const rows = await loadPublishedPosts(supabase, now);
  const result: SocialReconcileJobResult = {
    scanned: rows.length,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const row of rows) {
    if (!row.platform_post_id) continue;

    try {
      const metrics = await publisher.fetchEngagement(row.platform_post_id);
      await updateMetrics({ supabase, rowId: row.id, metrics, now });
      result.updated += 1;
      logger.log("[Social Reconcile] metrics updated", {
        postId: row.id,
        platformPostId: row.platform_post_id,
      });
    } catch (error) {
      result.failed += 1;
      const message = `${row.id}: ${errorMessage(error)}`;
      result.errors.push(message);
      logger.error("[Social Reconcile] metrics update failed", {
        postId: row.id,
        error: errorMessage(error),
      });
    }
  }

  logger.log("[Social Reconcile] complete", result);
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runSocialReconcileJob().catch((error) => {
    console.error("[Social Reconcile] fatal error", error);
    process.exitCode = 1;
  });
}
