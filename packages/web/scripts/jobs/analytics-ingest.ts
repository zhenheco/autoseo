#!/usr/bin/env tsx

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createAnalyticsIngestor } from "../../src/lib/analytics/ingestor";
import { HttpGA4Client } from "../../src/lib/analytics/sources/ga4-client";
import { HttpGSCAnalyticsClient } from "../../src/lib/analytics/sources/gsc-client";

function numberFromMetric(
  metrics: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeSocialMetrics(metrics: unknown) {
  const record =
    metrics && typeof metrics === "object"
      ? (metrics as Record<string, unknown>)
      : {};

  return {
    impressions: numberFromMetric(record, ["impressions", "impression_count"]),
    reach: numberFromMetric(record, ["reach", "unique_impressions"]),
    views: numberFromMetric(record, ["views", "view_count"]),
    clicks: numberFromMetric(record, ["clicks", "link_clicks"]),
    likes: numberFromMetric(record, ["likes", "like_count"]),
    comments: numberFromMetric(record, ["comments", "comment_count"]),
    shares: numberFromMetric(record, ["shares", "share_count", "reposts"]),
    raw: record,
  };
}

function yesterdayUtc(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
}

function parseArgs(argv: string[]) {
  const result: { date?: Date; onlyBrandId?: string } = {};

  for (const arg of argv) {
    if (arg.startsWith("--date=")) {
      result.date = new Date(`${arg.slice("--date=".length)}T00:00:00.000Z`);
    }
    if (arg.startsWith("--brand-id=")) {
      result.onlyBrandId = arg.slice("--brand-id=".length);
    }
  }

  return result;
}

function createProductionDeps() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    ga4Client: new HttpGA4Client({
      accessToken:
        process.env.GA4_ACCESS_TOKEN ||
        process.env.GOOGLE_ANALYTICS_ACCESS_TOKEN ||
        "",
      propertyId: process.env.GA4_PROPERTY_ID,
      endpoint: process.env.GA4_API_BASE_URL,
    }),
    gscClient: new HttpGSCAnalyticsClient({
      accessToken:
        process.env.GSC_ACCESS_TOKEN ||
        process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN ||
        "",
      siteUrl: process.env.GSC_SITE_URL,
      endpoint: process.env.GSC_API_BASE_URL,
    }),
    socialPublisher: {
      async fetchEngagement(postId: string) {
        const byPlatformPostId = await supabase
          .from("social_posts")
          .select("metrics")
          .eq("platform_post_id", postId)
          .maybeSingle();

        if (byPlatformPostId.error) {
          throw new Error(
            byPlatformPostId.error.message || "Failed to load social metrics",
          );
        }

        if (byPlatformPostId.data) {
          return normalizeSocialMetrics(
            (byPlatformPostId.data as { metrics?: unknown }).metrics,
          );
        }

        const byId = await supabase
          .from("social_posts")
          .select("metrics")
          .eq("id", postId)
          .maybeSingle();

        if (byId.error) {
          throw new Error(
            byId.error.message || "Failed to load social metrics",
          );
        }

        return normalizeSocialMetrics(
          (byId.data as { metrics?: unknown } | null)?.metrics,
        );
      },
    },
    supabase: supabase as never,
  };
}

export async function runAnalyticsIngest(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const date = args.date ?? yesterdayUtc();
  const ingestor = createAnalyticsIngestor(createProductionDeps());
  const report = await ingestor.ingest(date, {
    onlyBrandId: args.onlyBrandId,
  });

  console.log("[Analytics Ingest] Complete", {
    date: date.toISOString().slice(0, 10),
    report,
  });

  const errors = [
    ...report.ga4.errors.map((error) => `ga4: ${error}`),
    ...report.gsc.errors.map((error) => `gsc: ${error}`),
    ...report.social.errors.map((error) => `social: ${error}`),
  ];

  for (const error of errors) {
    console.error(`[Analytics Ingest] ${error}`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }

  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runAnalyticsIngest().catch((error) => {
    console.error("[Analytics Ingest] Fatal error", error);
    process.exitCode = 1;
  });
}
