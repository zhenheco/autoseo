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
type TrendsQueryBuilder = PromiseLike<TrendsQueryResult> & {
  update(values: unknown): TrendsQueryBuilder;
  eq(column: string, value: unknown): TrendsQueryBuilder;
  select(columns: string): TrendsQueryBuilder;
  maybeSingle(): PromiseLike<TrendsQueryResult>;
};

const trendSignalIdSchema = z.string().uuid();

async function readTrendSignalId(route: RouteParams): Promise<string | null> {
  const { id } = await route.params;
  const parsed = trendSignalIdSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export const POST = withRouteAuth(
  "company",
  async (_request: NextRequest, { supabase }, route: RouteParams) => {
    const id = await readTrendSignalId(route);
    if (!id) {
      return validationError("Invalid trend signal id format");
    }

    const db = supabase as unknown as TrendsDb;
    const { data, error } = await db
      .from("trend_signals")
      .update({ used_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[Trends] Dismiss failed:", error);
      return internalError("Failed to dismiss trend signal");
    }

    if (!data) {
      return notFound("Trend signal");
    }

    return successResponse({ id });
  },
);
