import { base64UrlDecode, base64UrlEncode } from "./base64";

export const SHOPLINE_OAUTH_SCOPES = [
  "read_products",
  "write_products",
  "read_product_listings",
  "read_content",
  "write_content",
  "write_page",
] as const;

export type ShoplineScope = (typeof SHOPLINE_OAUTH_SCOPES)[number];

export type VerifiedShoplineOAuthState = {
  workspaceId: string;
  siteId: string;
  shopHandle: string;
  returnTo?: string;
  invitationToken?: string;
};

type ShoplineAppType = "public" | "customized";

type StatePayload = VerifiedShoplineOAuthState & {
  nonce: string;
  ts: number;
};

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SKEW_TOLERANCE_MS = 30 * 1000;

export function normalizeShoplineShopHandle(shopHandle: string): string {
  const trimmed = shopHandle.trim();
  let normalized = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    normalized = new URL(trimmed).hostname;
  }

  normalized = normalized
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopline\.com$/i, "");

  if (!/^[a-zA-Z0-9-]+$/.test(normalized)) {
    throw new Error("invalid_shopline_shop_handle");
  }

  return normalized;
}

function encodeUtf8(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const bytes = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  bytes.set(encoded);
  return bytes;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not set`);
  return value;
}

function getSecret(): Uint8Array<ArrayBuffer> {
  return encodeUtf8(requireEnv("OAUTH_STATE_SECRET"));
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    getSecret(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encodeUtf8(payload));
  return base64UrlEncode(new Uint8Array(sig));
}

async function hmacVerify(
  payload: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSign(payload);
  return constantTimeEqual(expected, signature);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function generateNonce(byteLen = 24): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function encodePayload(payload: StatePayload): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(value: string): StatePayload {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));
}

function getShoplineAppType(): ShoplineAppType {
  const appType = process.env.SHOPLINE_APP_TYPE ?? "customized";
  if (appType === "public" || appType === "customized") return appType;
  throw new Error(`Unsupported SHOPLINE_APP_TYPE: ${appType}`);
}

function isSafeRelativePath(value: string | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/\\")) return false;
  return true;
}

function appendOAuthParams(
  url: URL,
  input: {
    clientId: string;
    redirectUri: string;
    state: string;
  },
): URL {
  url.searchParams.set("appKey", input.clientId);
  url.searchParams.set("responseType", "code");
  url.searchParams.set("scope", SHOPLINE_OAUTH_SCOPES.join(","));
  url.searchParams.set("redirectUri", input.redirectUri);
  url.searchParams.set("customField", input.state);
  return url;
}

function appendOAuthParamsToTemplateUrl(
  url: URL,
  input: {
    clientId: string;
    redirectUri: string;
    state: string;
  },
): URL {
  const hashQueryIndex = url.hash.indexOf("?");

  if (hashQueryIndex >= 0) {
    const hashPath = url.hash.slice(0, hashQueryIndex);
    const hashParams = new URLSearchParams(url.hash.slice(hashQueryIndex + 1));

    if (!hashParams.has("appKey")) hashParams.set("appKey", input.clientId);
    if (!hashParams.has("responseType")) hashParams.set("responseType", "code");
    if (!hashParams.has("scope"))
      hashParams.set("scope", SHOPLINE_OAUTH_SCOPES.join(","));
    if (!hashParams.has("redirectUri"))
      hashParams.set("redirectUri", input.redirectUri);
    if (!hashParams.has("customField"))
      hashParams.set("customField", input.state);

    url.hash = `${hashPath}?${hashParams.toString()}`;
    return url;
  }

  if (!url.searchParams.has("appKey"))
    url.searchParams.set("appKey", input.clientId);
  if (!url.searchParams.has("responseType"))
    url.searchParams.set("responseType", "code");
  if (!url.searchParams.has("scope"))
    url.searchParams.set("scope", SHOPLINE_OAUTH_SCOPES.join(","));
  if (!url.searchParams.has("redirectUri"))
    url.searchParams.set("redirectUri", input.redirectUri);
  if (!url.searchParams.has("customField"))
    url.searchParams.set("customField", input.state);

  return url;
}

function substituteInstallTemplate(
  template: string,
  input: {
    clientId: string;
    redirectUri: string;
    scope: string;
    shopDomain: string;
    shopHandle: string;
    state: string;
  },
): string {
  return template
    .replaceAll("{clientId}", encodeURIComponent(input.clientId))
    .replaceAll("{redirectUri}", encodeURIComponent(input.redirectUri))
    .replaceAll("{scope}", encodeURIComponent(input.scope))
    .replaceAll("{shopDomain}", encodeURIComponent(input.shopDomain))
    .replaceAll("{shopHandle}", encodeURIComponent(input.shopHandle))
    .replaceAll("{state}", encodeURIComponent(input.state));
}

function buildInstallUrl(input: {
  clientId: string;
  redirectUri: string;
  shopHandle: string;
  state: string;
}): URL {
  const shopDomain = `${input.shopHandle}.myshopline.com`;

  if (
    getShoplineAppType() === "public" ||
    (getShoplineAppType() === "customized" &&
      !process.env.SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE)
  ) {
    const url = new URL(`https://${shopDomain}/admin/oauth-web/`);
    const params = appendOAuthParams(
      new URL("https://1wayseo.local/"),
      input,
    ).searchParams;
    url.hash = `/oauth/authorize?${params.toString()}`;
    return url;
  }

  const url = new URL(
    substituteInstallTemplate(
      requireEnv("SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE"),
      {
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        scope: SHOPLINE_OAUTH_SCOPES.join(","),
        shopDomain,
        shopHandle: input.shopHandle,
        state: input.state,
      },
    ),
  );

  if (url.protocol !== "https:") {
    throw new Error(
      "SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE must produce an https URL",
    );
  }

  return appendOAuthParamsToTemplateUrl(url, input);
}

export async function buildAuthorizeUrl(params: {
  workspaceId: string;
  siteId: string;
  shopHandle: string;
  returnTo?: string;
  invitationToken?: string;
}): Promise<{ url: string; cookieNonce: string }> {
  const shopHandle = normalizeShoplineShopHandle(params.shopHandle);

  const cookieNonce = generateNonce();
  const payload: StatePayload = {
    workspaceId: params.workspaceId,
    siteId: params.siteId,
    shopHandle,
    returnTo: params.returnTo,
    invitationToken: params.invitationToken,
    nonce: cookieNonce,
    ts: Date.now(),
  };
  const encoded = encodePayload(payload);
  const state = `${encoded}.${await hmacSign(encoded)}`;

  const url = buildInstallUrl({
    clientId: requireEnv("SHOPLINE_CLIENT_ID"),
    redirectUri: requireEnv("SHOPLINE_REDIRECT_URI"),
    shopHandle,
    state,
  });

  const scope = SHOPLINE_OAUTH_SCOPES.join(",");
  return {
    url: url
      .toString()
      .replace(`scope=${encodeURIComponent(scope)}`, `scope=${scope}`),
    cookieNonce,
  };
}

export async function verifyState(
  stateParam: string,
  cookieNonce: string,
): Promise<VerifiedShoplineOAuthState> {
  if (!cookieNonce) throw new Error("cookie nonce missing");

  const dot = stateParam.lastIndexOf(".");
  if (dot < 0) throw new Error("invalid state format");

  const encoded = stateParam.slice(0, dot);
  const sig = stateParam.slice(dot + 1);
  if (!(await hmacVerify(encoded, sig))) throw new Error("state HMAC invalid");

  let payload: StatePayload;
  try {
    payload = decodePayload(encoded);
  } catch {
    throw new Error("state payload decode failed");
  }

  const now = Date.now();
  if (now - payload.ts > STATE_MAX_AGE_MS) throw new Error("state expired");
  if (payload.ts > now + SKEW_TOLERANCE_MS)
    throw new Error("state from future (clock skew exceeded)");
  if (!constantTimeEqual(payload.nonce, cookieNonce))
    throw new Error("cookie nonce mismatch");

  return {
    workspaceId: payload.workspaceId,
    siteId: payload.siteId,
    shopHandle: payload.shopHandle,
    returnTo: isSafeRelativePath(payload.returnTo)
      ? payload.returnTo
      : undefined,
    invitationToken: payload.invitationToken,
  };
}

export async function verifyShoplineHmac(
  searchParams: URLSearchParams,
): Promise<boolean> {
  const expectedHmac = searchParams.get("hmac") ?? searchParams.get("sign");
  if (!expectedHmac) return false;

  const params = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== "hmac" && key !== "sign") params.set(key, value);
  }

  const canonical = [...params.keys()]
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params.get(key) ?? "")}`,
    )
    .join("&");

  const key = await crypto.subtle.importKey(
    "raw",
    encodeUtf8(requireEnv("SHOPLINE_CLIENT_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encodeUtf8(canonical));
  const hex = [...new Uint8Array(sig)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqual(hex.toLowerCase(), expectedHmac.toLowerCase());
}

export async function exchangeCodeForToken(
  shopHandle: string,
  code: string,
): Promise<{ access_token: string; scope: string }> {
  const normalizedShopHandle = normalizeShoplineShopHandle(shopHandle);

  const tokenUrl = `https://${normalizedShopHandle}.myshopline.com/admin/oauth/token/create`;
  const body = JSON.stringify({ code });
  const timestamp = String(Date.now());
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      appkey: requireEnv("SHOPLINE_CLIENT_ID"),
      timestamp,
      sign: await signShoplinePostBody(body, timestamp),
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`shopline_token_exchange_failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    access_token?: string;
    scope?: string;
    code?: number;
    message?: string | null;
    data?: {
      accessToken?: string;
      scope?: string;
    };
  };

  if (data.access_token) {
    return { access_token: data.access_token, scope: data.scope ?? "" };
  }

  if (data.code !== 200 || !data.data?.accessToken) {
    throw new Error(
      `shopline_token_exchange_failed: ${data.code ?? "unknown"} ${data.message ?? "missing accessToken"}`,
    );
  }

  return {
    access_token: data.data.accessToken,
    scope: data.data.scope ?? "",
  };
}

async function signShoplinePostBody(
  body: string,
  timestamp: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encodeUtf8(requireEnv("SHOPLINE_CLIENT_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encodeUtf8(`${body}${timestamp}`),
  );
  return [...new Uint8Array(sig)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
