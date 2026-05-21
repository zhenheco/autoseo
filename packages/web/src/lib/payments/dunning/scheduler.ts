import { createAdminClient } from "@shared/supabase";
import {
  enqueueTransactionalTemplateEmail,
  type TransactionalTemplateName,
} from "@/lib/email/cf-email-client";

export interface DunningScheduler {
  startDunning(
    stripeInvoiceId: string,
    userId: string,
    locale: string,
  ): Promise<void>;
  cancelDunning(stripeInvoiceId: string): Promise<void>;
}

type DunningDay = 1 | 3 | 7;
type DunningStatus = "pending" | "sent" | "cancelled" | "failed" | "suppressed";
type DunningTemplateName = Extract<
  TransactionalTemplateName,
  "payment_failed_d1" | "payment_failed_d3" | "payment_failed_d7"
>;

type DunningScheduleRow = {
  id?: string;
  stripe_invoice_id: string;
  user_id: string;
  locale: string;
  dunning_day: DunningDay;
  template: DunningTemplateName;
  idempotency_key: string;
  scheduled_for: string;
  status: DunningStatus;
  sent_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  attempt_count?: number;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SupabaseResult<T> = PromiseLike<{ data: T | null; error: unknown }>;
type DunningQueryBuilder<T = DunningScheduleRow[]> = {
  select(columns?: string): DunningQueryBuilder<T>;
  upsert(
    rows: DunningScheduleRow[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): SupabaseResult<DunningScheduleRow[]>;
  update(patch: Partial<DunningScheduleRow>): DunningQueryBuilder<T>;
  eq(column: string, value: unknown): DunningQueryBuilder<T>;
  in(column: string, values: unknown[]): DunningQueryBuilder<T>;
  lte(column: string, value: string): DunningQueryBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): DunningQueryBuilder<T>;
  limit(limit: number): DunningQueryBuilder<T>;
} & SupabaseResult<T>;

type DunningSupabaseClient = {
  from(table: "dunning_schedules"): DunningQueryBuilder;
  auth: {
    admin: {
      getUserById(userId: string): Promise<{
        data: { user: { email?: string | null } | null };
        error: unknown;
      }>;
    };
  };
};

const DUNNING_DAYS = [1, 3, 7] as const;
const DAY_TO_TEMPLATE = {
  1: "payment_failed_d1",
  3: "payment_failed_d3",
  7: "payment_failed_d7",
} satisfies Record<DunningDay, DunningTemplateName>;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createDunningScheduler(input?: {
  supabase?: DunningSupabaseClient;
  now?: () => Date;
}): DunningScheduler {
  const supabase =
    input?.supabase ??
    (createAdminClient() as unknown as DunningSupabaseClient);
  const now = input?.now ?? (() => new Date());

  return {
    async startDunning(stripeInvoiceId, userId, locale) {
      const baseTime = now().getTime();
      const rows = DUNNING_DAYS.map((day) => ({
        stripe_invoice_id: stripeInvoiceId,
        user_id: userId,
        locale: normalizeLocale(locale),
        dunning_day: day,
        template: DAY_TO_TEMPLATE[day],
        idempotency_key: dunningIdempotencyKey(stripeInvoiceId, day),
        scheduled_for: new Date(baseTime + day * DAY_MS).toISOString(),
        status: "pending" as const,
      }));

      const { error } = await supabase.from("dunning_schedules").upsert(rows, {
        onConflict: "idempotency_key",
        ignoreDuplicates: true,
      });
      if (error) throw error;
    },

    async cancelDunning(stripeInvoiceId) {
      const { error } = await supabase
        .from("dunning_schedules")
        .update({
          status: "cancelled",
          cancelled_at: now().toISOString(),
          cancellation_reason: "invoice_paid",
          updated_at: now().toISOString(),
        })
        .eq("stripe_invoice_id", stripeInvoiceId)
        .eq("status", "pending");

      if (error) throw error;
    },
  };
}

export async function processDueDunningSchedules(input?: {
  supabase?: DunningSupabaseClient;
  now?: Date;
  limit?: number;
}): Promise<{
  processed: number;
  sent: number;
  failed: number;
  suppressed: number;
}> {
  const supabase =
    input?.supabase ??
    (createAdminClient() as unknown as DunningSupabaseClient);
  const now = input?.now ?? new Date();
  const { data, error } = await supabase
    .from("dunning_schedules")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(input?.limit ?? 50);

  if (error) throw error;

  const rows = data ?? [];
  const result = { processed: rows.length, sent: 0, failed: 0, suppressed: 0 };

  for (const row of rows) {
    try {
      const email = await readUserEmail(supabase, row.user_id);
      if (!email) throw new Error("dunning_user_email_missing");

      const sendResult = await enqueueTransactionalTemplateEmail({
        to: email,
        template: row.template,
        idempotencyKey: row.idempotency_key,
        context: {
          dunningDay: row.dunning_day,
          locale: row.locale,
          stripeInvoiceId: row.stripe_invoice_id,
          userId: row.user_id,
        },
      });

      if (!sendResult.ok) {
        if (sendResult.error === "recipient_suppressed") {
          await markSuppressed(supabase, row, now);
          result.suppressed += 1;
          continue;
        }

        throw new Error(sendResult.error ?? "dunning_email_send_failed");
      }

      await markSent(supabase, row, now);
      result.sent += 1;
    } catch (error) {
      await markFailed(
        supabase,
        row,
        error instanceof Error ? error.message : String(error),
        now,
      );
      result.failed += 1;
    }
  }

  return result;
}

function dunningIdempotencyKey(stripeInvoiceId: string, day: DunningDay) {
  return `dunning-${stripeInvoiceId}-${day}`;
}

function normalizeLocale(locale: string) {
  return locale.trim() || "en";
}

async function readUserEmail(supabase: DunningSupabaseClient, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user?.email ?? undefined;
}

async function markSent(
  supabase: DunningSupabaseClient,
  row: DunningScheduleRow,
  now: Date,
) {
  const { error } = await updateScheduleRow(supabase, row, {
    status: "sent",
    sent_at: now.toISOString(),
    updated_at: now.toISOString(),
    last_error: null,
  });
  if (error) throw error;
}

async function markSuppressed(
  supabase: DunningSupabaseClient,
  row: DunningScheduleRow,
  now: Date,
) {
  const { error: currentError } = await updateScheduleRow(supabase, row, {
    status: "suppressed",
    updated_at: now.toISOString(),
    last_error: "recipient_suppressed",
  });
  if (currentError) throw currentError;

  const { error: pendingError } = await supabase
    .from("dunning_schedules")
    .update({
      status: "cancelled",
      cancelled_at: now.toISOString(),
      cancellation_reason: "recipient_suppressed",
      updated_at: now.toISOString(),
    })
    .eq("stripe_invoice_id", row.stripe_invoice_id)
    .eq("status", "pending");
  if (pendingError) throw pendingError;
}

async function markFailed(
  supabase: DunningSupabaseClient,
  row: DunningScheduleRow,
  message: string,
  now: Date,
) {
  const { error } = await updateScheduleRow(supabase, row, {
    status: "failed",
    attempt_count: (row.attempt_count ?? 0) + 1,
    last_error: message,
    updated_at: now.toISOString(),
  });
  if (error) throw error;
}

function updateScheduleRow(
  supabase: DunningSupabaseClient,
  row: DunningScheduleRow,
  patch: Partial<DunningScheduleRow>,
) {
  const query = supabase.from("dunning_schedules").update(patch);
  if (row.id) return query.eq("id", row.id);
  return query.eq("idempotency_key", row.idempotency_key);
}
