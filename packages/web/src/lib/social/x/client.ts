import { refreshXToken } from "./refresh";
import {
  UpstreamRateLimitError,
  type ClientPublishInput,
  type PublishResult,
} from "../types";

const X_TWEETS_URL = "https://api.x.com/2/tweets";
const X_MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";

export interface XClient {
  publish(input: ClientPublishInput): Promise<PublishResult>;
}

type XClientOptions = {
  fetchImpl?: typeof fetch;
};

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

function nestedDataId(data: Record<string, unknown>, label: string): string {
  const nested = data.data;
  if (
    nested &&
    typeof nested === "object" &&
    "id" in nested &&
    typeof nested.id === "string"
  ) {
    return nested.id;
  }

  if (typeof data.media_id_string === "string") {
    return data.media_id_string;
  }

  throw new Error(`${label}_missing_id`);
}

async function assertXResponse(response: Response, label: string) {
  const data = await readJson(response);

  if (response.status === 429) {
    throw new UpstreamRateLimitError(parseRetryAfter(response));
  }

  if (!response.ok || data.errors) {
    throw new Error(`${label}_failed`);
  }

  return data;
}

function bearerHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export function createXClient(options: XClientOptions = {}): XClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async publish(input: ClientPublishInput): Promise<PublishResult> {
      let accessToken = await input.tokenCrypto.decrypt(
        input.socialAccount.access_token_encrypted,
      );

      const execute = async (
        label: string,
        request: (token: string) => Promise<Response>,
      ) => {
        let response = await request(accessToken);

        if (response.status === 401) {
          const refreshResult = await refreshXToken(input.socialAccount.id, {
            supabase: input.supabase as never,
            tokenCrypto: input.tokenCrypto,
            fetchImpl,
          });
          accessToken = refreshResult.accessToken;
          response = await request(accessToken);
        }

        return assertXResponse(response, label);
      };

      const mediaIds = [];
      for (const mediaUrl of input.content.mediaUrls ?? []) {
        const mediaData = await execute("x_media_upload", (token) =>
          fetchImpl(X_MEDIA_UPLOAD_URL, {
            method: "POST",
            headers: bearerHeaders(token),
            body: JSON.stringify({ media_url: mediaUrl }),
          }),
        );
        mediaIds.push(nestedDataId(mediaData, "x_media_upload"));
      }

      const tweetBody: Record<string, unknown> = {
        text: input.content.text,
      };
      if (mediaIds.length > 0) {
        tweetBody.media = { media_ids: mediaIds };
      }

      const tweetData = await execute("x_tweet_create", (token) =>
        fetchImpl(X_TWEETS_URL, {
          method: "POST",
          headers: bearerHeaders(token),
          body: JSON.stringify(tweetBody),
        }),
      );

      return {
        publishedPostId: nestedDataId(tweetData, "x_tweet_create"),
        publishedAt: new Date(),
        platform: "x",
      };
    },
  };
}
