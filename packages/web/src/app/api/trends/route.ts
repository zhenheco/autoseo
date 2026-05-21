import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { internalError } from "@/lib/api/response-helpers";
import { ACTIVE_BRAND_COOKIE } from "@/lib/brands/constants";

type TrendsDb = {
  from(table: string): TrendsQueryBuilder;
};

type TrendsQueryResult<T = unknown> = {
  data?: T | null;
  error?: { message?: string } | null;
};

type TrendsQueryBuilder = PromiseLike<TrendsQueryResult> & {
  select(columns: string): TrendsQueryBuilder;
  eq(column: string, value: unknown): TrendsQueryBuilder;
  is(column: string, value: unknown): TrendsQueryBuilder;
  or(filters: string): TrendsQueryBuilder;
  order(column: string, options?: Record<string, unknown>): TrendsQueryBuilder;
  limit(count: number): TrendsQueryBuilder;
};

type BrandRow = {
  id: string;
};

type TrendSignalRow = {
  id: string;
  brand_id: string;
  topic: string;
  source: "perplexity" | "gsc" | "google_trends" | "manual";
  confidence: number | string;
  metadata: Record<string, unknown> | null;
};

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

async function resolveActiveBrandId(
  request: NextRequest,
  db: TrendsDb,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("brands")
    .select("id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load active brand");
  }

  const brands = Array.isArray(data) ? (data as BrandRow[]) : [];
  if (brands.length === 0) return null;

  const queryBrandId = request.nextUrl.searchParams.get("brand");
  const cookieBrandId = readCookie(
    request.headers.get("cookie") ?? request.headers.get("Cookie"),
    ACTIVE_BRAND_COOKIE,
  );

  return (
    brands.find((brand) => brand.id === queryBrandId)?.id ??
    brands.find((brand) => brand.id === cookieBrandId)?.id ??
    brands[0]?.id ??
    null
  );
}

export const GET = withRouteAuth(
  "company",
  async (request: NextRequest, { supabase, companyId }) => {
    try {
      const db = supabase as unknown as TrendsDb;
      const brandId = await resolveActiveBrandId(request, db, companyId);

      if (!brandId) {
        return NextResponse.json({ signals: [] });
      }

      const now = new Date().toISOString();
      const { data, error } = await db
        .from("trend_signals")
        .select("id, brand_id, topic, source, confidence, metadata")
        .eq("brand_id", brandId)
        .is("used_at", null)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("confidence", { ascending: false })
        .limit(5);

      if (error) {
        console.error("[Trends] List failed:", error);
        return internalError("Failed to list trend signals");
      }

      const signals = ((data ?? []) as TrendSignalRow[]).map((signal) => ({
        id: signal.id,
        brandId: signal.brand_id,
        topic: signal.topic,
        source: signal.source,
        confidence: Number(signal.confidence),
        metadata: signal.metadata,
      }));

      return NextResponse.json({ signals });
    } catch (error) {
      console.error("[Trends] List fatal error:", error);
      return internalError("Failed to list trend signals");
    }
  },
);
