export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_USERS_ME_URL = "https://api.x.com/2/users/me";

export const X_OAUTH_SCOPE = "tweet.read tweet.write users.read offline.access";

export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

export type XOAuthTokenResponse = {
  token_type?: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  scope?: string;
};

export type XUserMe = {
  id: string;
  username: string;
  name?: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function generateRandomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(
  codeVerifier: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export async function generatePkcePair(): Promise<PkcePair> {
  const codeVerifier = generateRandomBase64Url(64);
  return {
    codeVerifier,
    codeChallenge: await createCodeChallenge(codeVerifier),
  };
}

export function buildXAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(X_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", X_OAUTH_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function getXClientCredentials(): { clientId: string; clientSecret?: string } {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("X_CLIENT_ID is not configured");
  }

  return { clientId, clientSecret };
}

function buildTokenHeaders(
  clientId: string,
  clientSecret?: string,
): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(
      `${clientId}:${clientSecret}`,
      "utf8",
    ).toString("base64")}`;
  }

  return headers;
}

async function parseTokenResponse(
  response: Response,
): Promise<XOAuthTokenResponse> {
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error ?? "x_token_request_failed");
  }

  if (!data.access_token || typeof data.expires_in !== "number") {
    throw new Error("x_token_response_invalid");
  }

  return data as XOAuthTokenResponse;
}

export async function exchangeAuthorizationCodeForXTokens(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<XOAuthTokenResponse> {
  const { clientId, clientSecret } = getXClientCredentials();
  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(X_TOKEN_URL, {
    method: "POST",
    headers: buildTokenHeaders(clientId, clientSecret),
    body: new URLSearchParams({
      code: input.code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });

  return parseTokenResponse(response);
}

export async function refreshXOAuthTokens(input: {
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<XOAuthTokenResponse> {
  const { clientId, clientSecret } = getXClientCredentials();
  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(X_TOKEN_URL, {
    method: "POST",
    headers: buildTokenHeaders(clientId, clientSecret),
    body: new URLSearchParams({
      refresh_token: input.refreshToken,
      grant_type: "refresh_token",
      client_id: clientId,
    }),
  });

  return parseTokenResponse(response);
}

export async function fetchXUserMe(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<XUserMe> {
  const url = new URL(X_USERS_ME_URL);
  url.searchParams.set("user.fields", "username,name");

  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();

  if (!response.ok || data.error || !data.data?.id) {
    throw new Error(data.error ?? "x_user_lookup_failed");
  }

  return data.data as XUserMe;
}
