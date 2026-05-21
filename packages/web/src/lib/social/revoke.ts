import type { TokenCrypto } from "@/lib/security/token-crypto";
import { getSocialTokenCrypto } from "@/lib/social/token-crypto";
import type { Platform, SocialAccount } from "./types";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v19.0";
const X_REVOKE_URL = "https://api.x.com/2/oauth2/revoke";
const LINKEDIN_REVOKE_URL = "https://www.linkedin.com/oauth/v2/revoke";

export type RevokeSocialAccountResult = {
  attempted: boolean;
  ok?: boolean;
  error?: string;
};

function isMetaFamily(platform: Platform): boolean {
  return (
    platform === "instagram" ||
    platform === "facebook" ||
    platform === "threads"
  );
}

function xClientCredentials(): { clientId: string; clientSecret?: string } {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    throw new Error("X_CLIENT_ID is not configured");
  }
  return { clientId, clientSecret: process.env.X_CLIENT_SECRET };
}

function xRevokeHeaders(clientId: string, clientSecret?: string): HeadersInit {
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

async function revokeMetaToken(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const url = new URL(`${META_GRAPH_BASE_URL}/me/permissions`);
  url.searchParams.set("access_token", accessToken);
  return fetchImpl(url.toString(), { method: "DELETE" });
}

async function revokeXToken(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const { clientId, clientSecret } = xClientCredentials();
  return fetchImpl(X_REVOKE_URL, {
    method: "POST",
    headers: xRevokeHeaders(clientId, clientSecret),
    body: new URLSearchParams({
      token: accessToken,
      token_type_hint: "access_token",
      client_id: clientId,
    }),
  });
}

async function revokeLinkedInToken(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(LINKEDIN_REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: accessToken }),
  });
}

export async function revokeSocialAccountToken(
  account: SocialAccount,
  options: {
    tokenCrypto?: TokenCrypto;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RevokeSocialAccountResult> {
  try {
    const tokenCrypto = options.tokenCrypto ?? getSocialTokenCrypto();
    const fetchImpl = options.fetchImpl ?? fetch;
    const accessToken = await tokenCrypto.decrypt(
      account.access_token_encrypted,
    );
    let response: Response;

    if (isMetaFamily(account.platform)) {
      response = await revokeMetaToken(accessToken, fetchImpl);
    } else if (account.platform === "x") {
      response = await revokeXToken(accessToken, fetchImpl);
    } else if (account.platform === "linkedin") {
      response = await revokeLinkedInToken(accessToken, fetchImpl);
    } else {
      return { attempted: false, error: "unsupported_platform" };
    }

    return {
      attempted: true,
      ok: response.ok,
      ...(response.ok ? {} : { error: `status_${response.status}` }),
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : "revoke_failed",
    };
  }
}
