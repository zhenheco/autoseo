export const META_GRAPH_VERSION = "v19.0";
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_AUTHORIZE_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
export const THREADS_GRAPH_BASE_URL = "https://graph.threads.net/v1.0";

export const META_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "threads_basic",
  "threads_content_publish",
  "business_management",
] as const;

export const META_OAUTH_SCOPE = META_OAUTH_SCOPES.join(",");

export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in: number;
};

export type MetaInstagramBusinessAccount = {
  id: string;
  username?: string;
  name?: string;
};

export type MetaPage = {
  id: string;
  name?: string;
  username?: string;
  access_token?: string;
  instagram_business_account?: MetaInstagramBusinessAccount | null;
};

export type MetaMeWithAccounts = {
  id: string;
  name?: string;
  accounts?: {
    data?: MetaPage[];
  };
};

export type ThreadsProfile = {
  id: string;
  username?: string;
  name?: string;
};

function getMetaAppConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("meta_oauth_not_configured");
  }

  return { appId, appSecret };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function parseMetaResponse<T>(
  response: Response,
  errorCode: string,
): Promise<T> {
  const data = await readJson(response);

  if (!response.ok || data.error) {
    throw new Error(errorCode);
  }

  return data as T;
}

function assertAccessToken(data: MetaTokenResponse, errorCode: string) {
  if (!data.access_token || typeof data.expires_in !== "number") {
    throw new Error(errorCode);
  }
}

export function generateMetaState(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function buildMetaAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(META_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", META_OAUTH_SCOPE);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeMetaCodeForShortLivedToken(input: {
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaTokenResponse> {
  const { appId, appSecret } = getMetaAppConfig();
  const fetcher = input.fetchImpl ?? fetch;
  const url = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code);

  const data = await parseMetaResponse<MetaTokenResponse>(
    await fetcher(url.toString()),
    "meta_code_exchange_failed",
  );
  assertAccessToken(data, "meta_code_exchange_invalid");
  return data;
}

export async function exchangeMetaTokenForLongLivedToken(input: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaTokenResponse> {
  const { appId, appSecret } = getMetaAppConfig();
  const fetcher = input.fetchImpl ?? fetch;
  const url = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", input.accessToken);

  const data = await parseMetaResponse<MetaTokenResponse>(
    await fetcher(url.toString()),
    "meta_long_lived_exchange_failed",
  );
  assertAccessToken(data, "meta_long_lived_exchange_invalid");
  return data;
}

export async function fetchMetaMeWithAccounts(input: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaMeWithAccounts> {
  const fetcher = input.fetchImpl ?? fetch;
  const url = new URL(`${META_GRAPH_BASE_URL}/me`);
  url.searchParams.set(
    "fields",
    "id,name,accounts{id,name,username,access_token,instagram_business_account{id,username,name}}",
  );
  url.searchParams.set("access_token", input.accessToken);

  const data = await parseMetaResponse<MetaMeWithAccounts>(
    await fetcher(url.toString()),
    "meta_me_lookup_failed",
  );

  if (!data.id) {
    throw new Error("meta_me_lookup_invalid");
  }

  return data;
}

export async function fetchMetaPageAccess(input: {
  pageId: string;
  userAccessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaPage> {
  const fetcher = input.fetchImpl ?? fetch;
  const url = new URL(`${META_GRAPH_BASE_URL}/${input.pageId}`);
  url.searchParams.set(
    "fields",
    "id,name,username,access_token,instagram_business_account{id,username,name}",
  );
  url.searchParams.set("access_token", input.userAccessToken);

  const data = await parseMetaResponse<MetaPage>(
    await fetcher(url.toString()),
    "meta_page_access_lookup_failed",
  );

  if (!data.id || !data.access_token) {
    throw new Error("meta_page_access_lookup_invalid");
  }

  return data;
}

export async function fetchThreadsProfile(input: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<ThreadsProfile> {
  const fetcher = input.fetchImpl ?? fetch;
  const profileUrl = new URL(`${THREADS_GRAPH_BASE_URL}/me`);
  profileUrl.searchParams.set("fields", "id,username,name");
  profileUrl.searchParams.set("access_token", input.accessToken);

  const profile = await parseMetaResponse<ThreadsProfile>(
    await fetcher(profileUrl.toString()),
    "threads_profile_lookup_failed",
  );

  if (!profile.id) {
    throw new Error("threads_profile_lookup_invalid");
  }

  const limitsUrl = new URL(
    `${THREADS_GRAPH_BASE_URL}/me/threads_publishing_limit`,
  );
  limitsUrl.searchParams.set("fields", "quota_usage,config");
  limitsUrl.searchParams.set("access_token", input.accessToken);
  await parseMetaResponse<Record<string, unknown>>(
    await fetcher(limitsUrl.toString()),
    "threads_publishing_limit_lookup_failed",
  );

  return profile;
}
