import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MetaPublishGatedError,
  PublishBackoffScheduledError,
  createSocialPublisher,
} from "../publisher";
import { createInMemorySocialRateLimiter } from "../rate-limiter";
import { createMetaClient } from "../meta/client";
import { createXClient } from "../x/client";
import type { Platform, SocialAccount } from "../types";

const tokenCrypto = {
  decrypt: vi.fn(async (value: string) => value.replace("encrypted:", "")),
  encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
};

function socialAccount(
  platform: Platform,
  overrides: Partial<SocialAccount> = {},
): SocialAccount {
  return {
    id: `${platform}-account`,
    brand_id: "brand-1",
    platform,
    platform_account_id: `${platform}-remote-id`,
    platform_username: `${platform}-user`,
    access_token_encrypted: `encrypted:${platform}-access-token`,
    refresh_token_encrypted: `encrypted:${platform}-refresh-token`,
    token_expires_at: null,
    connected_at: "2026-05-22T00:00:00.000Z",
    disconnected_at: null,
    ...overrides,
  };
}

function createSupabaseMock() {
  const insert = vi.fn(async () => ({ error: null }));
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));

  const refreshQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: "x-account",
        refresh_token_encrypted: "encrypted:x-refresh-token",
      },
      error: null,
    })),
  };

  const from = vi.fn((table: string) => {
    if (table === "social_posts") return { insert };
    if (table === "social_accounts")
      return { select: refreshQuery.select, update };
    return {};
  });

  return {
    client: { from },
    from,
    insert,
    update,
    updateEq,
    refreshQuery,
  };
}

function createPublisher(input: {
  fetchImpl: typeof fetch;
  supabase?: ReturnType<typeof createSupabaseMock>["client"];
  refreshMetaTokenImpl?: NonNullable<
    Parameters<typeof createMetaClient>[0]
  >["refreshMetaTokenImpl"];
}) {
  return createSocialPublisher({
    metaClient: createMetaClient({
      fetchImpl: input.fetchImpl,
      refreshMetaTokenImpl: input.refreshMetaTokenImpl,
    }),
    xClient: createXClient({ fetchImpl: input.fetchImpl }),
    tokenCrypto,
    rateLimiter: createInMemorySocialRateLimiter(),
    supabase: input.supabase ?? createSupabaseMock().client,
  });
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

describe("SocialPublisher", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.stubEnv("META_PUBLISH_ENABLED", "true");
    vi.stubEnv("X_PUBLISH_ENABLED", "true");
    vi.stubEnv("X_CLIENT_ID", "x-client-id");
    vi.stubEnv("X_CLIENT_SECRET", "x-client-secret");
  });

  it("publishes Instagram content with the Graph media create then publish flow", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "ig-container-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "ig-post-1" }));
    const publisher = createPublisher({ fetchImpl: fetchImpl as never });

    await expect(
      publisher.publish({
        socialAccount: socialAccount("instagram"),
        content: {
          text: "A polished launch caption",
          mediaUrls: ["https://cdn.example.com/card.png"],
        },
      }),
    ).resolves.toMatchObject({
      platform: "instagram",
      publishedPostId: "ig-post-1",
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://graph.facebook.com/v19.0/instagram-remote-id/media",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://graph.facebook.com/v19.0/instagram-remote-id/media_publish",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("publishes Facebook Page posts", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "fb-post-1" }));
    const publisher = createPublisher({ fetchImpl: fetchImpl as never });

    await expect(
      publisher.publish({
        socialAccount: socialAccount("facebook"),
        content: { text: "New article is live" },
      }),
    ).resolves.toMatchObject({
      platform: "facebook",
      publishedPostId: "fb-post-1",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://graph.facebook.com/v19.0/facebook-remote-id/feed",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("publishes Threads posts through the Graph API client", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "threads-post-1" }));
    const publisher = createPublisher({ fetchImpl: fetchImpl as never });

    await expect(
      publisher.publish({
        socialAccount: socialAccount("threads"),
        content: { text: "Threaded insight" },
      }),
    ).resolves.toMatchObject({
      platform: "threads",
      publishedPostId: "threads-post-1",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://graph.facebook.com/v19.0/threads-remote-id/threads",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("publishes X posts", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "tweet-1", text: "Ship note" } }),
    );
    const publisher = createPublisher({ fetchImpl: fetchImpl as never });

    await expect(
      publisher.publish({
        socialAccount: socialAccount("x"),
        content: { text: "Ship note" },
      }),
    ).resolves.toMatchObject({
      platform: "x",
      publishedPostId: "tweet-1",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.x.com/2/tweets",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer x-access-token",
        }),
      }),
    );
  });

  it("reschedules when upstream returns 429", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T04:00:00.000Z"));
    const supabase = createSupabaseMock();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: { message: "rate limited" } },
        {
          status: 429,
          headers: { "Retry-After": "120" },
        },
      ),
    );
    const publisher = createPublisher({
      fetchImpl: fetchImpl as never,
      supabase: supabase.client,
    });

    await expect(
      publisher.publish({
        socialAccount: socialAccount("facebook"),
        content: { text: "Backoff please" },
      }),
    ).rejects.toBeInstanceOf(PublishBackoffScheduledError);

    expect(supabase.insert).toHaveBeenCalledWith({
      social_account_id: "facebook-account",
      scheduled_at: "2026-05-22T04:02:00.000Z",
      status: "scheduled",
      content_text: "Backoff please",
      media_urls: null,
      error_message: "Upstream rate limit hit; rescheduled after 120 seconds",
      retry_count: 1,
    });
    vi.useRealTimers();
  });

  it("refreshes a Meta token once after a 401 and retries publish", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: "expired" }, { status: 401 }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "fb-post-after-refresh" }));
    const refreshMetaTokenImpl = vi.fn(async () => ({
      accessToken: "fresh-meta-token",
      expiresAt: "2026-05-22T06:00:00.000Z",
    }));
    const publisher = createPublisher({
      fetchImpl: fetchImpl as never,
      refreshMetaTokenImpl,
    });

    await expect(
      publisher.publish({
        socialAccount: socialAccount("facebook"),
        content: { text: "Retry after refresh" },
      }),
    ).resolves.toMatchObject({
      publishedPostId: "fb-post-after-refresh",
    });

    expect(refreshMetaTokenImpl).toHaveBeenCalledWith(
      expect.objectContaining({ socialAccountId: "facebook-account" }),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gates Meta-family publishing when App Review flag is off", async () => {
    vi.stubEnv("META_PUBLISH_ENABLED", "false");
    const fetchImpl = vi.fn();
    const publisher = createPublisher({ fetchImpl: fetchImpl as never });

    await expect(
      publisher.publish({
        socialAccount: socialAccount("instagram"),
        content: { text: "Should be gated" },
      }),
    ).rejects.toBeInstanceOf(MetaPublishGatedError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
