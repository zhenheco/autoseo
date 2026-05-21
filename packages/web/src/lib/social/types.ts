import type { TokenCrypto } from "@/lib/security/token-crypto";

export type Platform = "instagram" | "facebook" | "threads" | "x";

export type SocialAccount = {
  id: string;
  brand_id?: string;
  platform: Platform;
  platform_account_id: string;
  platform_username?: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted?: string | null;
  token_expires_at?: string | null;
  connected_at?: string;
  disconnected_at?: string | null;
};

export type PublishContent = {
  text: string;
  mediaUrls?: string[];
};

export interface PublishResult {
  publishedPostId: string;
  publishedAt: Date;
  platform: Platform;
}

export interface SupabaseServerClient {
  from(table: string): unknown;
}

export type ClientPublishInput = {
  socialAccount: SocialAccount;
  content: PublishContent;
  tokenCrypto: TokenCrypto;
  supabase: SupabaseServerClient;
};

export class SocialPublisherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class MetaPublishGatedError extends SocialPublisherError {
  constructor() {
    super("Meta publishing is gated until App Review approval");
  }
}

export class XPublishGatedError extends SocialPublisherError {
  constructor() {
    super("X publishing is disabled by feature flag");
  }
}

export class UnsupportedSocialPlatformError extends SocialPublisherError {
  constructor(platform: string) {
    super(`Unsupported social publishing platform: ${platform}`);
  }
}

export class UpstreamRateLimitError extends SocialPublisherError {
  readonly retryAfterSeconds: number;
  readonly retryAt: Date;

  constructor(retryAfterSeconds: number, now = new Date()) {
    super(`Upstream rate limit hit; retry after ${retryAfterSeconds} seconds`);
    this.retryAfterSeconds = retryAfterSeconds;
    this.retryAt = new Date(now.getTime() + retryAfterSeconds * 1000);
  }
}

export class PublishBackoffScheduledError extends SocialPublisherError {
  readonly retryAt: Date;

  constructor(retryAt: Date) {
    super(`Publish rescheduled for ${retryAt.toISOString()}`);
    this.retryAt = retryAt;
  }
}
