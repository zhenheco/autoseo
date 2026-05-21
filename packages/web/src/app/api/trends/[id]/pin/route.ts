import { NextRequest } from "next/server";
import { z } from "zod";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  internalError,
  notFound,
  successResponse,
  validationError,
} from "@/lib/api/response-helpers";

type RouteParams = { params: Promise<{ id: string }> };
type TrendsDb = {
  from(table: string): TrendsQueryBuilder;
};
type TrendsQueryResult<T = unknown> = {
  data?: T | null;
  error?: { message?: string } | null;
};
type TrendSignalRow = {
  id: string;
  metadata?: unknown;
};
type TrendsQueryBuilder = PromiseLike<TrendsQueryResult> & {
  select(columns: string): TrendsQueryBuilder;
  update(values: unknown): TrendsQueryBuilder;
  eq(column: string, value: unknown): TrendsQueryBuilder;
  maybeSingle(): PromiseLike<TrendsQueryResult>;
};

const trendSignalIdSchema = z.string().uuid();

async function readTrendSignalId(route: RouteParams): Promise<string | null> {
  const { id } = await route.params;
  const parsed = trendSignalIdSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function withPinnedTag(metadata: Record<string, unknown>) {
  const existingTags = Array.isArray(metadata.tags)
    ? metadata.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    ...metadata,
    tags: [...new Set([...existingTags, "pinned"])],
    pinned_at: new Date().toISOString(),
  };
}

export const POST = withRouteAuth(
  "company",
  async (_request: NextRequest, { supabase }, route: RouteParams) => {
    const id = await readTrendSignalId(route);
    if (!id) {
      return validationError("Invalid trend signal id format");
    }

    const db = supabase as unknown as TrendsDb;
    const { data: existing, error: readError } = (await db
      .from("trend_signals")
      .select("id, metadata")
      .eq("id", id)
      .maybeSingle()) as TrendsQueryResult<TrendSignalRow>;

    if (readError) {
      console.error("[Trends] Pin lookup failed:", readError);
      return internalError("Failed to pin trend signal");
    }

    if (!existing) {
      return notFound("Trend signal");
    }

    const metadata = withPinnedTag(asMetadata(existing.metadata));
    const { data, error } = await db
      .from("trend_signals")
      .update({ metadata })
      .eq("id", id)
      .select("id, metadata")
      .maybeSingle();

    if (error) {
      console.error("[Trends] Pin failed:", error);
      return internalError("Failed to pin trend signal");
    }

    if (!data) {
      return notFound("Trend signal");
    }

    return successResponse({ id, metadata });
  },
);
