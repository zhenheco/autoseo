import { NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";

type SignedRequestPayload = {
  algorithm?: unknown;
  user_id?: unknown;
};

type IdRow = {
  id?: unknown;
};

type CompanyMembershipRow = {
  company_id?: unknown;
};

export async function POST(request: Request) {
  const signedRequest = await readSignedRequest(request);
  if (!signedRequest) {
    return NextResponse.json(
      { error: "missing_signed_request" },
      { status: 400 },
    );
  }

  const payload = await verifySignedRequest(
    signedRequest,
    process.env.META_APP_SECRET,
  );
  if (!payload) {
    return NextResponse.json(
      { error: "invalid_signed_request" },
      { status: 400 },
    );
  }

  const userId = normalizeUserId(payload.user_id);
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  const confirmationCode = `meta-del-${crypto.randomUUID()}`;
  try {
    await deleteSocialAccountsForUser(userId);
  } catch {
    return NextResponse.json(
      { error: "data_deletion_failed" },
      { status: 500 },
    );
  }

  const statusUrl = new URL(request.url);
  statusUrl.searchParams.set("code", confirmationCode);

  return NextResponse.json({
    url: statusUrl.toString(),
    confirmation_code: confirmationCode,
  });
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return NextResponse.json(
      { error: "missing_confirmation_code" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    confirmation_code: code,
    status: "processed",
  });
}

async function readSignedRequest(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    const value = formData.get("signed_request");
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { signed_request?: unknown };
      return typeof body.signed_request === "string" &&
        body.signed_request.trim()
        ? body.signed_request.trim()
        : null;
    } catch {
      return null;
    }
  }

  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const signedRequest = params.get("signed_request") ?? rawBody;
  return signedRequest.trim() ? signedRequest.trim() : null;
}

async function verifySignedRequest(
  signedRequest: string,
  appSecret: string | undefined,
): Promise<SignedRequestPayload | null> {
  if (!appSecret) return null;

  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;

  const [encodedSignature, encodedPayload] = parts;
  if (!encodedSignature || !encodedPayload) return null;

  let payload: SignedRequestPayload;
  try {
    payload = JSON.parse(decodeBase64UrlToString(encodedPayload));
  } catch {
    return null;
  }

  if (
    typeof payload.algorithm === "string" &&
    payload.algorithm.toUpperCase() !== "HMAC-SHA256"
  ) {
    return null;
  }

  const actualSignature = decodeBase64UrlToBytes(encodedSignature);
  if (!actualSignature) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedSignature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(encodedPayload),
    ),
  );

  if (!constantTimeEqual(actualSignature, expectedSignature)) return null;
  return payload;
}

async function deleteSocialAccountsForUser(userId: string) {
  const supabase = createAdminClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipError) throw new Error("membership_lookup_failed");

  const companyIds = uniqueStrings(
    (memberships as CompanyMembershipRow[] | null)?.map(
      (membership) => membership.company_id,
    ) ?? [],
  );
  if (companyIds.length === 0) return;

  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id")
    .in("company_id", companyIds)
    .is("deleted_at", null);

  if (brandsError) throw new Error("brand_lookup_failed");

  const brandIds = uniqueStrings(
    (brands as IdRow[] | null)?.map((brand) => brand.id) ?? [],
  );
  if (brandIds.length === 0) return;

  const { error: deletionError } = await supabase
    .from("social_accounts")
    .delete()
    .in("brand_id", brandIds);

  if (deletionError) throw new Error("social_account_delete_failed");
}

function normalizeUserId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string => typeof value === "string" && value !== "",
      ),
    ),
  );
}

function decodeBase64UrlToString(value: string): string {
  return new TextDecoder().decode(
    decodeBase64UrlToBytes(value) ?? new Uint8Array(),
  );
}

function decodeBase64UrlToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }

  return difference === 0;
}
