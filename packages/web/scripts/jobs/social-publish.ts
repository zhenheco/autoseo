#!/usr/bin/env tsx

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { enqueueOpsAlertEmail } from "../../src/lib/email/cf-email-client";
import { createMetaClient } from "../../src/lib/social/meta/client";
import {
  PublishBackoffScheduledError,
  UpstreamRateLimitError,
  createSocialPublisher,
  type SocialPublisher,
} from "../../src/lib/social/publisher";
import { createInMemorySocialRateLimiter } from "../../src/lib/social/rate-limiter";
import { getSocialTokenCrypto } from "../../src/lib/social/token-crypto";
import { createXClient } from "../../src/lib/social/x/client";
import type { SocialAccount } from "../../src/lib/social/types";

type SupabaseLike = {
  from(table: string): unknown;
};

type Logger = Pick<Console, "log" | "warn" | "error">;

export type ScheduledSocialPostRow = {
  id: string;
  social_account_id: string | null;
  platform_post_id: string | null;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  content_text: string | null;
  media_urls: string[] | null;
  error_message: string | null;
  retry_count: number | null;
  social_accounts: SocialAccount | SocialAccount[] | null;
};

type AlertOps = typeof enqueueOpsAlertEmail;

type SocialPostsQueryBuilder = {
  select(columns: string): SocialPostsQueryBuilder;
  eq(column: string, value: unknown): SocialPostsQueryBuilder;
  lte(column: string, value: string): SocialPostsQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): SocialPostsQueryBuilder;
  limit(value: number): PromiseLike<{
    data: ScheduledSocialPostRow[] | null;
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

export type SocialPublishJobResult = {
  scanned: number;
  published: number;
  rescheduled: number;
  failed: number;
  alertsSent: number;
  alertFailures: number;
};

const DUE_POSTS_SELECT = `
  id,
  social_account_id,
  platform_post_id,
  scheduled_at,
  published_at,
  status,
  content_text,
  media_urls,
  error_message,
  retry_count,
  social_accounts (
    id,
    brand_id,
    platform,
    platform_account_id,
    platform_username,
    access_token_encrypted,
    refresh_token_encrypted,
    token_expires_at,
    connected_at,
    disconnected_at
  )
`;

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

function createProductionPublisher(supabase: SupabaseLike): SocialPublisher {
  return createSocialPublisher({
    metaClient: createMetaClient(),
    xClient: createXClient(),
    tokenCrypto: getSocialTokenCrypto(),
    rateLimiter: createInMemorySocialRateLimiter(),
    supabase: supabase as never,
    rescheduleOnRateLimit: false,
  });
}

async function loadDuePosts(
  supabase: SupabaseLike,
  now: Date,
): Promise<ScheduledSocialPostRow[]> {
  const builder = supabase.from("social_posts") as SocialPostsQueryBuilder;
  const { data, error } = await builder
    .select(DUE_POSTS_SELECT)
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(error.message || "social_publish_due_posts_query_failed");
  }

  return data ?? [];
}

async function updateSocialPost(
  supabase: SupabaseLike,
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const builder = supabase.from("social_posts") as SocialPostsUpdateBuilder;
  const { error } = await builder.update(payload).eq("id", id);
  if (error) {
    throw new Error(error.message || "social_publish_update_failed");
  }
}

function firstSocialAccount(row: ScheduledSocialPostRow): SocialAccount | null {
  if (Array.isArray(row.social_accounts)) {
    return row.social_accounts[0] ?? null;
  }
  return row.social_accounts ?? null;
}

function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof UpstreamRateLimitError ||
    error instanceof PublishBackoffScheduledError ||
    (error instanceof Error &&
      (error.name === "UpstreamRateLimitError" ||
        error.name === "PublishBackoffScheduledError"))
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function oneHourFrom(now: Date): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
}

async function alertPermanentFailure(input: {
  alertOps: AlertOps;
  row: ScheduledSocialPostRow;
  error: unknown;
}): Promise<boolean> {
  const result = await input.alertOps({
    subject: "Social publish failed",
    text: [
      "A scheduled social post failed permanently.",
      "",
      `post_id: ${input.row.id}`,
      `social_account_id: ${input.row.social_account_id ?? "missing"}`,
      `scheduled_at: ${input.row.scheduled_at}`,
      `error: ${errorMessage(input.error)}`,
    ].join("\n"),
    idempotencyKey: `social-publish-failed:${input.row.id}`,
  });

  return result.ok;
}

export async function runSocialPublishJob(
  input: {
    now?: Date;
    supabase?: SupabaseLike;
    publisher?: Pick<SocialPublisher, "publish">;
    alertOps?: AlertOps;
    logger?: Logger;
  } = {},
): Promise<SocialPublishJobResult> {
  const now = input.now ?? new Date();
  const logger = input.logger ?? console;
  const supabase = input.supabase ?? requireProductionSupabase();
  const publisher = input.publisher ?? createProductionPublisher(supabase);
  const alertOps = input.alertOps ?? enqueueOpsAlertEmail;
  const rows = await loadDuePosts(supabase, now);
  const result: SocialPublishJobResult = {
    scanned: rows.length,
    published: 0,
    rescheduled: 0,
    failed: 0,
    alertsSent: 0,
    alertFailures: 0,
  };

  for (const row of rows) {
    const socialAccount = firstSocialAccount(row);
    const contentText = row.content_text?.trim();

    try {
      if (!socialAccount) {
        throw new Error("social_account_missing");
      }
      if (!contentText) {
        throw new Error("content_text_missing");
      }

      const publishResult = await publisher.publish({
        socialAccount,
        content: {
          text: contentText,
          mediaUrls: row.media_urls?.length ? row.media_urls : undefined,
        },
      });

      await updateSocialPost(supabase, row.id, {
        status: "published",
        platform_post_id: publishResult.publishedPostId,
        published_at: publishResult.publishedAt.toISOString(),
        error_message: null,
      });
      result.published += 1;
      logger.log("[Social Publish] published", {
        postId: row.id,
        platformPostId: publishResult.publishedPostId,
      });
    } catch (error) {
      if (isRateLimitError(error)) {
        const nextRetryCount = (row.retry_count ?? 0) + 1;
        await updateSocialPost(supabase, row.id, {
          status: "scheduled",
          scheduled_at: oneHourFrom(now),
          retry_count: nextRetryCount,
          error_message: errorMessage(error),
        });
        result.rescheduled += 1;
        logger.warn("[Social Publish] rate limited; rescheduled", {
          postId: row.id,
          retryCount: nextRetryCount,
        });
        continue;
      }

      await updateSocialPost(supabase, row.id, {
        status: "failed",
        error_message: errorMessage(error),
      });
      result.failed += 1;

      try {
        if (await alertPermanentFailure({ alertOps, row, error })) {
          result.alertsSent += 1;
        } else {
          result.alertFailures += 1;
        }
      } catch (alertError) {
        result.alertFailures += 1;
        logger.error("[Social Publish] ops alert failed", {
          postId: row.id,
          error: errorMessage(alertError),
        });
      }
    }
  }

  logger.log("[Social Publish] complete", result);
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runSocialPublishJob().catch((error) => {
    console.error("[Social Publish] fatal error", error);
    process.exitCode = 1;
  });
}
