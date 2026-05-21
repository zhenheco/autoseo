import { createAdminClient } from "@shared/supabase";
import type { TokenCrypto } from "@/lib/security/token-crypto";
import type { MetaClient } from "./meta/client";
import type { RateLimiter } from "./rate-limiter";
import type { XClient } from "./x/client";
import {
  MetaPublishGatedError,
  PublishBackoffScheduledError,
  UnsupportedSocialPlatformError,
  UpstreamRateLimitError,
  XPublishGatedError,
  type Platform,
  type PublishContent,
  type PublishResult,
  type SocialAccount,
  type SupabaseServerClient,
} from "./types";

export type { Platform, PublishResult, SocialAccount };
export {
  MetaPublishGatedError,
  PublishBackoffScheduledError,
  UpstreamRateLimitError,
  XPublishGatedError,
};

export type SocialEngagement = {
  impressions?: number;
  reach?: number;
  views?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  raw?: Record<string, unknown>;
};

export interface SocialPublisher {
  publish(input: PublishInput): Promise<PublishResult>;
  fetchEngagement(postId: string): Promise<SocialEngagement>;
}

type SupabaseLike = ReturnType<typeof createAdminClient>;

export interface PublishInput {
  socialAccount: SocialAccount;
  content: PublishContent;
  scheduleAt?: Date;
}

type PublishDeps = {
  metaClient: MetaClient;
  xClient: XClient;
  tokenCrypto: TokenCrypto;
  rateLimiter: RateLimiter;
  supabase: SupabaseServerClient;
};

type SocialPublisherDeps = Partial<PublishDeps> & {
  supabase?: SupabaseLike | SupabaseServerClient;
};

function numberFromMetric(
  metrics: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeMetrics(metrics: unknown): SocialEngagement {
  const record =
    metrics && typeof metrics === "object"
      ? (metrics as Record<string, unknown>)
      : {};

  return {
    impressions: numberFromMetric(record, ["impressions", "impression_count"]),
    reach: numberFromMetric(record, ["reach", "unique_impressions"]),
    views: numberFromMetric(record, ["views", "view_count"]),
    clicks: numberFromMetric(record, ["clicks", "link_clicks"]),
    likes: numberFromMetric(record, ["likes", "like_count"]),
    comments: numberFromMetric(record, ["comments", "comment_count"]),
    shares: numberFromMetric(record, ["shares", "share_count", "reposts"]),
    raw: record,
  };
}

function isMetaFamily(platform: Platform): boolean {
  return (
    platform === "instagram" ||
    platform === "facebook" ||
    platform === "threads"
  );
}

function isMetaPublishEnabled(): boolean {
  return process.env.META_PUBLISH_ENABLED === "true";
}

function isXPublishEnabled(): boolean {
  return process.env.X_PUBLISH_ENABLED !== "false";
}

function assertPublishDeps(
  deps: SocialPublisherDeps | undefined,
): asserts deps is PublishDeps {
  if (
    !deps?.metaClient ||
    !deps.xClient ||
    !deps.tokenCrypto ||
    !deps.rateLimiter ||
    !deps.supabase
  ) {
    throw new Error("social_publisher_publish_deps_missing");
  }
}

type SocialPostsInsertBuilder = {
  insert(payload: Record<string, unknown>): PromiseLike<{ error?: unknown }>;
};

async function rescheduleAfterBackoff(
  supabase: SupabaseServerClient,
  input: PublishInput,
  error: UpstreamRateLimitError,
): Promise<void> {
  const builder = supabase.from("social_posts") as SocialPostsInsertBuilder;
  const { error: insertError } = await builder.insert({
    social_account_id: input.socialAccount.id,
    scheduled_at: error.retryAt.toISOString(),
    status: "scheduled",
    content_text: input.content.text,
    media_urls: input.content.mediaUrls?.length
      ? input.content.mediaUrls
      : null,
    error_message: `Upstream rate limit hit; rescheduled after ${error.retryAfterSeconds} seconds`,
    retry_count: 1,
  });

  if (insertError) {
    throw insertError instanceof Error
      ? insertError
      : new Error("social_publish_backoff_reschedule_failed");
  }
}

export function createSocialPublisher(
  deps?: SocialPublisherDeps,
): SocialPublisher {
  const supabase = (deps?.supabase ?? createAdminClient()) as SupabaseLike;

  return {
    async publish(input: PublishInput): Promise<PublishResult> {
      assertPublishDeps(deps);
      const { socialAccount } = input;

      if (isMetaFamily(socialAccount.platform) && !isMetaPublishEnabled()) {
        throw new MetaPublishGatedError();
      }

      if (socialAccount.platform === "x" && !isXPublishEnabled()) {
        throw new XPublishGatedError();
      }

      await deps.rateLimiter.acquire(
        socialAccount.platform,
        socialAccount.platform_account_id,
      );

      try {
        if (isMetaFamily(socialAccount.platform)) {
          return await deps.metaClient.publish({
            ...input,
            tokenCrypto: deps.tokenCrypto,
            supabase: deps.supabase,
          });
        }

        if (socialAccount.platform === "x") {
          return await deps.xClient.publish({
            ...input,
            tokenCrypto: deps.tokenCrypto,
            supabase: deps.supabase,
          });
        }
      } catch (error) {
        if (error instanceof UpstreamRateLimitError) {
          await rescheduleAfterBackoff(deps.supabase, input, error);
          throw new PublishBackoffScheduledError(error.retryAt);
        }

        throw error;
      }

      throw new UnsupportedSocialPlatformError(socialAccount.platform);
    },

    async fetchEngagement(postId: string): Promise<SocialEngagement> {
      const byPlatformPostId = await supabase
        .from("social_posts")
        .select("metrics")
        .eq("platform_post_id", postId)
        .maybeSingle();

      if (byPlatformPostId.error) {
        throw new Error(
          byPlatformPostId.error.message || "Failed to load social metrics",
        );
      }

      if (byPlatformPostId.data) {
        return normalizeMetrics(
          (byPlatformPostId.data as { metrics?: unknown }).metrics,
        );
      }

      const byId = await supabase
        .from("social_posts")
        .select("metrics")
        .eq("id", postId)
        .maybeSingle();

      if (byId.error) {
        throw new Error(byId.error.message || "Failed to load social metrics");
      }

      return normalizeMetrics(
        (byId.data as { metrics?: unknown } | null)?.metrics,
      );
    },
  };
}
