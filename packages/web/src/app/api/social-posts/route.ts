import { NextRequest } from "next/server";
import { z } from "zod";
import {
  internalError,
  notFound,
  successResponse,
  validationError,
} from "@/lib/api/response-helpers";
import { withRouteAuth } from "@/lib/api/route-auth";
import type { Database } from "@/types/database.types";

type Platform =
  Database["public"]["Tables"]["social_accounts"]["Row"]["platform"];
type PostStatus = Database["public"]["Tables"]["social_posts"]["Row"]["status"];

const brandIdSchema = z.string().uuid();
const statusSchema = z.enum([
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);
const platformSchema = z.enum([
  "instagram",
  "threads",
  "facebook",
  "x",
  "linkedin",
]);

type SocialPostSelection = {
  id: string;
  social_account_id: string | null;
  scheduled_at: string;
  published_at: string | null;
  status: PostStatus;
  content_text: string | null;
  metrics: unknown;
  social_accounts:
    | { platform: Platform; brand_id: string }
    | Array<{ platform: Platform; brand_id: string }>
    | null;
};

function readBoundedInteger(
  params: URLSearchParams,
  key: string,
  fallback: number,
  max: number,
): number {
  const raw = params.get(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function firstSocialAccount(row: SocialPostSelection) {
  return Array.isArray(row.social_accounts)
    ? row.social_accounts[0]
    : row.social_accounts;
}

function contentSnippet(content: string | null): string {
  if (!content) return "";
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 120
    ? `${normalized.slice(0, 117)}...`
    : normalized;
}

export const GET = withRouteAuth(
  "company",
  async (request: NextRequest, { supabase, companyId }) => {
    const params =
      request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const brandIdResult = brandIdSchema.safeParse(params.get("brandId"));
    if (!brandIdResult.success) {
      return validationError("brandId is required");
    }

    const statusResult = params.has("status")
      ? statusSchema.safeParse(params.get("status"))
      : null;
    if (statusResult && !statusResult.success) {
      return validationError("Invalid status filter");
    }

    const platformResult = params.has("platform")
      ? platformSchema.safeParse(params.get("platform"))
      : null;
    if (platformResult && !platformResult.success) {
      return validationError("Invalid platform filter");
    }

    const brandId = brandIdResult.data;
    const limit = readBoundedInteger(params, "limit", 10, 30);
    const offset = readBoundedInteger(params, "offset", 0, 29);

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (brandError) {
      console.error("[SocialPosts] Brand lookup failed:", brandError);
      return internalError("Failed to read brand");
    }

    if (!brand) {
      return notFound("Brand");
    }

    let query = supabase
      .from("social_posts")
      .select(
        "id, social_account_id, scheduled_at, published_at, status, content_text, metrics, social_accounts!inner(platform, brand_id)",
        { count: "exact" },
      )
      .eq("social_accounts.brand_id", brandId)
      .order("scheduled_at", { ascending: false })
      .range(offset, Math.min(29, offset + limit - 1));

    if (statusResult?.success) {
      query = query.eq("status", statusResult.data);
    }

    if (platformResult?.success) {
      query = query.eq("social_accounts.platform", platformResult.data);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[SocialPosts] List failed:", error);
      return internalError("Failed to load social posts");
    }

    const rows = Array.isArray(data) ? (data as SocialPostSelection[]) : [];
    const posts = rows.map((row) => {
      const account = firstSocialAccount(row);
      return {
        id: row.id,
        socialAccountId: row.social_account_id,
        platform: account?.platform ?? null,
        contentSnippet: contentSnippet(row.content_text),
        scheduledAt: row.scheduled_at,
        publishedAt: row.published_at,
        status: row.status,
        metrics: row.metrics ?? {},
      };
    });
    const total = typeof count === "number" ? Math.min(count, 30) : null;

    return successResponse({
      posts,
      pagination: {
        limit,
        offset,
        total,
        hasMore:
          total === null
            ? posts.length === limit
            : offset + posts.length < total,
      },
    });
  },
);
