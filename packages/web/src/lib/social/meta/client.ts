import type { TokenCrypto } from "@/lib/security/token-crypto";
import {
  UpstreamRateLimitError,
  type ClientPublishInput,
  type Platform,
  type PublishContent,
  type PublishResult,
  type SocialAccount,
  type SupabaseServerClient,
} from "../types";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v19.0";

export interface MetaClient {
  publish(input: ClientPublishInput): Promise<PublishResult>;
}

export type RefreshMetaTokenResult = {
  accessToken: string;
  expiresAt?: string;
};

export type RefreshMetaTokenImpl = (input: {
  socialAccountId: string;
  socialAccount: SocialAccount;
  tokenCrypto: TokenCrypto;
  supabase: SupabaseServerClient;
  fetchImpl: typeof fetch;
}) => Promise<RefreshMetaTokenResult | null>;

type MetaClientOptions = {
  fetchImpl?: typeof fetch;
  refreshMetaTokenImpl?: RefreshMetaTokenImpl;
};

type SupabaseUpdateBuilder = {
  update(payload: Record<string, unknown>): {
    eq(column: string, value: string): PromiseLike<{ error?: unknown }>;
  };
};

async function refreshMetaToken(): Promise<RefreshMetaTokenResult | null> {
  console.warn(
    "[MetaClient] refreshMetaToken is not implemented yet; waiting for #94",
  );
  return null;
}

function parseRetryAfter(response: Response): number {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return 60;

  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) return Math.max(1, seconds);

  const retryAt = Date.parse(retryAfter);
  if (!Number.isNaN(retryAt)) {
    return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
  }

  return 60;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function assertMetaResponse(response: Response) {
  const data = await readJson(response);

  if (response.status === 429) {
    throw new UpstreamRateLimitError(parseRetryAfter(response));
  }

  if (!response.ok || data.error) {
    throw new Error("meta_publish_request_failed");
  }

  return data;
}

function requireId(data: Record<string, unknown>, label: string): string {
  if (typeof data.id !== "string" || data.id.length === 0) {
    throw new Error(`${label}_missing_id`);
  }

  return data.id;
}

function firstMediaUrl(content: PublishContent): string | undefined {
  return content.mediaUrls?.find((url) => url.trim().length > 0);
}

async function storeRefreshedMetaToken(input: {
  socialAccount: SocialAccount;
  supabase: SupabaseServerClient;
  tokenCrypto: TokenCrypto;
  refreshResult: RefreshMetaTokenResult;
}) {
  const builder = input.supabase.from(
    "social_accounts",
  ) as SupabaseUpdateBuilder;
  const payload: Record<string, unknown> = {
    access_token_encrypted: await input.tokenCrypto.encrypt(
      input.refreshResult.accessToken,
    ),
    disconnected_at: null,
  };

  if (input.refreshResult.expiresAt) {
    payload.token_expires_at = input.refreshResult.expiresAt;
  }

  const { error } = await builder
    .update(payload)
    .eq("id", input.socialAccount.id);
  if (error) {
    throw new Error("meta_refresh_token_update_failed");
  }
}

async function executeMetaRequest(input: {
  socialAccount: SocialAccount;
  tokenCrypto: TokenCrypto;
  supabase: SupabaseServerClient;
  fetchImpl: typeof fetch;
  refreshMetaTokenImpl: RefreshMetaTokenImpl;
  request: (accessToken: string) => Promise<Response>;
}): Promise<Record<string, unknown>> {
  let accessToken = await input.tokenCrypto.decrypt(
    input.socialAccount.access_token_encrypted,
  );
  let response = await input.request(accessToken);

  if (response.status === 401) {
    const refreshResult = await input.refreshMetaTokenImpl({
      socialAccountId: input.socialAccount.id,
      socialAccount: input.socialAccount,
      tokenCrypto: input.tokenCrypto,
      supabase: input.supabase,
      fetchImpl: input.fetchImpl,
    });

    if (!refreshResult) {
      throw new Error("meta_token_refresh_unavailable");
    }

    await storeRefreshedMetaToken({
      socialAccount: input.socialAccount,
      supabase: input.supabase,
      tokenCrypto: input.tokenCrypto,
      refreshResult,
    });
    accessToken = refreshResult.accessToken;
    response = await input.request(accessToken);
  }

  return assertMetaResponse(response);
}

function graphUrl(account: SocialAccount, edge: string): string {
  return `${META_GRAPH_BASE_URL}/${account.platform_account_id}/${edge}`;
}

function createGraphPostRequest(
  fetchImpl: typeof fetch,
  url: string,
  body: URLSearchParams,
) {
  return (accessToken: string) => {
    body.set("access_token", accessToken);
    return fetchImpl(url, {
      method: "POST",
      body,
    });
  };
}

async function publishInstagram(input: {
  socialAccount: SocialAccount;
  content: PublishContent;
  tokenCrypto: TokenCrypto;
  supabase: SupabaseServerClient;
  fetchImpl: typeof fetch;
  refreshMetaTokenImpl: RefreshMetaTokenImpl;
}): Promise<string> {
  const mediaUrl = firstMediaUrl(input.content);
  if (!mediaUrl) {
    throw new Error("instagram_publish_requires_media");
  }

  const createBody = new URLSearchParams({
    caption: input.content.text,
    image_url: mediaUrl,
  });
  const createData = await executeMetaRequest({
    ...input,
    request: createGraphPostRequest(
      input.fetchImpl,
      graphUrl(input.socialAccount, "media"),
      createBody,
    ),
  });
  const creationId = requireId(createData, "instagram_media_create");

  const publishBody = new URLSearchParams({ creation_id: creationId });
  const publishData = await executeMetaRequest({
    ...input,
    request: createGraphPostRequest(
      input.fetchImpl,
      graphUrl(input.socialAccount, "media_publish"),
      publishBody,
    ),
  });

  return requireId(publishData, "instagram_media_publish");
}

async function publishFacebook(input: {
  socialAccount: SocialAccount;
  content: PublishContent;
  tokenCrypto: TokenCrypto;
  supabase: SupabaseServerClient;
  fetchImpl: typeof fetch;
  refreshMetaTokenImpl: RefreshMetaTokenImpl;
}): Promise<string> {
  const body = new URLSearchParams({ message: input.content.text });
  const mediaUrl = firstMediaUrl(input.content);
  if (mediaUrl) body.set("link", mediaUrl);

  const data = await executeMetaRequest({
    ...input,
    request: createGraphPostRequest(
      input.fetchImpl,
      graphUrl(input.socialAccount, "feed"),
      body,
    ),
  });

  return requireId(data, "facebook_feed_post");
}

async function publishThreads(input: {
  socialAccount: SocialAccount;
  content: PublishContent;
  tokenCrypto: TokenCrypto;
  supabase: SupabaseServerClient;
  fetchImpl: typeof fetch;
  refreshMetaTokenImpl: RefreshMetaTokenImpl;
}): Promise<string> {
  const body = new URLSearchParams({
    media_type: firstMediaUrl(input.content) ? "IMAGE" : "TEXT",
    text: input.content.text,
  });
  const mediaUrl = firstMediaUrl(input.content);
  if (mediaUrl) body.set("image_url", mediaUrl);

  const data = await executeMetaRequest({
    ...input,
    request: createGraphPostRequest(
      input.fetchImpl,
      graphUrl(input.socialAccount, "threads"),
      body,
    ),
  });

  return requireId(data, "threads_post");
}

export function createMetaClient(options: MetaClientOptions = {}): MetaClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const refreshMetaTokenImpl = options.refreshMetaTokenImpl ?? refreshMetaToken;

  return {
    async publish(input: ClientPublishInput): Promise<PublishResult> {
      let publishedPostId: string;

      if (input.socialAccount.platform === "instagram") {
        publishedPostId = await publishInstagram({
          ...input,
          fetchImpl,
          refreshMetaTokenImpl,
        });
      } else if (input.socialAccount.platform === "facebook") {
        publishedPostId = await publishFacebook({
          ...input,
          fetchImpl,
          refreshMetaTokenImpl,
        });
      } else if (input.socialAccount.platform === "threads") {
        publishedPostId = await publishThreads({
          ...input,
          fetchImpl,
          refreshMetaTokenImpl,
        });
      } else {
        throw new Error(
          `Unsupported Meta platform: ${input.socialAccount.platform}`,
        );
      }

      return {
        publishedPostId,
        publishedAt: new Date(),
        platform: input.socialAccount.platform as Exclude<Platform, "x">,
      };
    },
  };
}
