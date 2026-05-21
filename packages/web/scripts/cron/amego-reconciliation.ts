#!/usr/bin/env tsx

/**
 * Daily Amego reconciliation.
 *
 * Intended schedule: 0 3 * * * (03:00 UTC daily).
 *
 * Run with:
 *   op run --env-file=.env.local -- pnpm tsx scripts/cron/amego-reconciliation.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  AmegoFatalError,
  AmegoRetryableError,
  createAmegoAdapter,
  type AmegoIssueInput,
} from "../../src/lib/payments/amego/adapter";
import type { Database, Json } from "../../src/types/database.types";

config({ path: ".env.local" });

const DEFAULT_MICROSERVICE_URL =
  "https://affiliate.1wayseo.com/api/amego/issue";
const WINDOW_DAYS = 7;

type InvoiceRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  | "stripe_invoice_id"
  | "amego_status"
  | "amego_payload"
  | "amego_retry_count"
  | "paid_at"
>;

async function main() {
  const supabase = createClient<Database>(
    requireEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
  const adapter = createAmegoAdapter({
    microserviceUrl:
      process.env.AMEGO_MICROSERVICE_URL ?? DEFAULT_MICROSERVICE_URL,
    hmacSecret: requireEnv(
      "AMEGO_MICROSERVICE_HMAC_SECRET",
      "AMEGO_HMAC_SECRET",
    ),
    fetch,
  });

  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "stripe_invoice_id,amego_status,amego_payload,amego_retry_count,paid_at",
    )
    .in("amego_status", ["pending", "failed"])
    .gte("paid_at", since)
    .order("paid_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as InvoiceRow[];
  const summary = {
    scanned: rows.length,
    issued: 0,
    skipped: 0,
    retryableFailures: 0,
    fatalFailures: 0,
  };

  console.log("[amego-reconciliation] start", {
    schedule: "0 3 * * *",
    since,
    candidates: rows.length,
  });

  for (const row of rows) {
    const payload = parsePayload(row.amego_payload);
    if (!payload) {
      summary.skipped += 1;
      console.warn("[amego-reconciliation] skipped missing payload", {
        stripeInvoiceId: row.stripe_invoice_id,
        status: row.amego_status,
      });
      continue;
    }

    try {
      const result = await adapter.issueInvoice(payload);
      await assertOk(
        supabase
          .from("invoices")
          .update({
            amego_invoice_number: result.invoiceNumber,
            amego_issued_at: result.issuedAt.toISOString(),
            amego_status: "issued",
            amego_last_error: null,
          })
          .eq("stripe_invoice_id", row.stripe_invoice_id),
      );
      summary.issued += 1;
      console.log("[amego-reconciliation] issued", {
        stripeInvoiceId: row.stripe_invoice_id,
        invoiceNumber: result.invoiceNumber,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = err instanceof AmegoRetryableError;
      const fatal = err instanceof AmegoFatalError || !retryable;
      if (retryable) summary.retryableFailures += 1;
      if (fatal) summary.fatalFailures += 1;

      await assertOk(
        supabase
          .from("invoices")
          .update({
            amego_status: fatal ? "failed" : row.amego_status,
            amego_last_error: message,
            amego_retry_count: row.amego_retry_count + 1,
          })
          .eq("stripe_invoice_id", row.stripe_invoice_id),
      );

      console.error("[amego-reconciliation] issue failed", {
        stripeInvoiceId: row.stripe_invoice_id,
        retryable,
        fatal,
        error: message,
      });
    }
  }

  console.log("[amego-reconciliation] complete", summary);
}

function parsePayload(value: Json | null): AmegoIssueInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const buyer = candidate.buyer as Record<string, unknown> | undefined;
  const items = candidate.items;

  if (
    typeof candidate.stripeInvoiceId !== "string" ||
    typeof candidate.amountUsd !== "number" ||
    typeof candidate.amountTwd !== "number" ||
    !buyer ||
    typeof buyer.name !== "string" ||
    typeof buyer.email !== "string" ||
    typeof buyer.country !== "string" ||
    !Array.isArray(items)
  ) {
    return null;
  }

  const parsedItems = items.map((item) => {
    const object = item as Record<string, unknown>;
    return {
      description:
        typeof object.description === "string"
          ? object.description
          : "1WaySEO subscription",
      quantity: typeof object.quantity === "number" ? object.quantity : 1,
      unitPriceTwd:
        typeof object.unitPriceTwd === "number" ? object.unitPriceTwd : 0,
    };
  });

  return {
    stripeInvoiceId: candidate.stripeInvoiceId,
    amountUsd: candidate.amountUsd,
    amountTwd: candidate.amountTwd,
    buyer: {
      name: buyer.name,
      email: buyer.email,
      country: buyer.country,
      taxId: typeof buyer.taxId === "string" ? buyer.taxId : undefined,
    },
    items: parsedItems,
  };
}

function requireEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(`missing_env:${keys.join("|")}`);
}

async function assertOk<T extends { error?: unknown }>(
  result: PromiseLike<T> | T,
) {
  const resolved = await result;
  if (resolved.error) throw resolved.error;
}

main().catch((error) => {
  console.error("[amego-reconciliation] crashed", error);
  process.exit(1);
});
