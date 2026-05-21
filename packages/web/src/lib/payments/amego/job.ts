import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueOpsAlertEmail } from "@/lib/email/cf-email-client";
import type { Database } from "@/types/database.types";
import {
  AmegoFatalError,
  AmegoRetryableError,
  createAmegoAdapter,
  type AmegoIssueInput,
} from "./adapter";

const DEFAULT_MICROSERVICE_URL =
  "https://affiliate.1wayseo.com/api/amego/issue";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;

type Supabase = SupabaseClient<Database>;

export function enqueueAmegoInvoiceIssue(input: {
  supabase: Supabase;
  payload: AmegoIssueInput;
  attempt?: number;
  setTimeoutFn?: typeof setTimeout;
  fetchFn?: typeof fetch;
}) {
  const setTimeoutFn = input.setTimeoutFn ?? setTimeout;
  const attempt = input.attempt ?? 1;

  setTimeoutFn(() => {
    void processAmegoInvoiceIssue({
      supabase: input.supabase,
      payload: input.payload,
      attempt,
      setTimeoutFn,
      fetchFn: input.fetchFn,
    }).catch((error) => {
      console.error("[amego] invoice job crashed", {
        stripeInvoiceId: input.payload.stripeInvoiceId,
        error: errorMessage(error),
      });
    });
  }, 0);
}

export async function processAmegoInvoiceIssue(input: {
  supabase: Supabase;
  payload: AmegoIssueInput;
  attempt?: number;
  setTimeoutFn?: typeof setTimeout;
  fetchFn?: typeof fetch;
}) {
  const attempt = input.attempt ?? 1;

  try {
    const adapter = createAmegoAdapter({
      microserviceUrl:
        process.env.AMEGO_MICROSERVICE_URL ?? DEFAULT_MICROSERVICE_URL,
      hmacSecret: readHmacSecret(),
      fetch: input.fetchFn ?? fetch,
    });
    const result = await adapter.issueInvoice(input.payload);

    await assertOk(
      input.supabase
        .from("invoices")
        .update({
          amego_invoice_number: result.invoiceNumber,
          amego_issued_at: result.issuedAt.toISOString(),
          amego_status: "issued",
          amego_retry_count: Math.max(0, attempt - 1),
          amego_last_error: null,
        })
        .eq("stripe_invoice_id", input.payload.stripeInvoiceId),
    );

    console.info("[amego] invoice issued", {
      stripeInvoiceId: input.payload.stripeInvoiceId,
      invoiceNumber: result.invoiceNumber,
    });
  } catch (error) {
    await handleAmegoFailure({
      ...input,
      attempt,
      error,
    });
  }
}

async function handleAmegoFailure(input: {
  supabase: Supabase;
  payload: AmegoIssueInput;
  attempt: number;
  error: unknown;
  setTimeoutFn?: typeof setTimeout;
  fetchFn?: typeof fetch;
}) {
  const retryable = input.error instanceof AmegoRetryableError;
  const fatal = input.error instanceof AmegoFatalError || !retryable;
  const nextRetryCount = input.attempt;
  const message = errorMessage(input.error);

  if (retryable && input.attempt < MAX_ATTEMPTS) {
    await assertOk(
      input.supabase
        .from("invoices")
        .update({
          amego_retry_count: nextRetryCount,
          amego_last_error: message,
        })
        .eq("stripe_invoice_id", input.payload.stripeInvoiceId),
    );

    const delayMs = BASE_BACKOFF_MS * 2 ** (input.attempt - 1);
    const setTimeoutFn = input.setTimeoutFn ?? setTimeout;
    setTimeoutFn(() => {
      void processAmegoInvoiceIssue({
        supabase: input.supabase,
        payload: input.payload,
        attempt: input.attempt + 1,
        setTimeoutFn,
        fetchFn: input.fetchFn,
      });
    }, delayMs);
    return;
  }

  await assertOk(
    input.supabase
      .from("invoices")
      .update({
        amego_status: "failed",
        amego_retry_count: nextRetryCount,
        amego_last_error: message,
      })
      .eq("stripe_invoice_id", input.payload.stripeInvoiceId),
  );

  await alertOps({
    stripeInvoiceId: input.payload.stripeInvoiceId,
    fatal,
    attempt: input.attempt,
    message,
  });
}

async function alertOps(input: {
  stripeInvoiceId: string;
  fatal: boolean;
  attempt: number;
  message: string;
}) {
  try {
    const result = await enqueueOpsAlertEmail({
      subject: `[1WaySEO] Amego invoice ${input.fatal ? "fatal failure" : "failed after retries"}`,
      text: [
        `stripe_invoice_id: ${input.stripeInvoiceId}`,
        `attempt: ${input.attempt}`,
        `fatal: ${input.fatal}`,
        `error: ${input.message}`,
      ].join("\n"),
      idempotencyKey: `amego:${input.stripeInvoiceId}:failed`,
    });
    if (!result.ok) {
      console.error("[amego] ops alert failed", {
        stripeInvoiceId: input.stripeInvoiceId,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[amego] ops alert crashed", {
      stripeInvoiceId: input.stripeInvoiceId,
      error: errorMessage(error),
    });
  }
}

function readHmacSecret() {
  const secret =
    process.env.AMEGO_MICROSERVICE_HMAC_SECRET ?? process.env.AMEGO_HMAC_SECRET;
  if (!secret) {
    throw new AmegoFatalError("amego_hmac_secret_not_configured");
  }
  return secret;
}

async function assertOk<T extends { error?: unknown }>(
  result: PromiseLike<T> | T,
) {
  const resolved = await result;
  if (resolved.error) throw resolved.error;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
