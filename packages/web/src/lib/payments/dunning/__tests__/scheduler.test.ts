import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDunningScheduler,
  processDueDunningSchedules,
} from "../scheduler";

type Row = Record<string, unknown>;
type DunningScheduleRow = {
  id?: string;
  stripe_invoice_id: string;
  user_id: string;
  locale: string;
  dunning_day: 1 | 3 | 7;
  template: "payment_failed_d1" | "payment_failed_d3" | "payment_failed_d7";
  idempotency_key: string;
  scheduled_for: string;
  status: "pending" | "sent" | "cancelled" | "failed" | "suppressed";
  sent_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  attempt_count?: number;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
};

type FakeState = {
  dunning_schedules: DunningScheduleRow[];
  userEmails: Record<string, string>;
};

type TableName = "dunning_schedules";

const emailClient = vi.hoisted(() => ({
  enqueueTransactionalTemplateEmail: vi.fn(),
}));

vi.mock("@/lib/email/cf-email-client", () => emailClient);

function createFakeSupabase(seed: Partial<FakeState> = {}) {
  const state: FakeState = {
    dunning_schedules: [],
    userEmails: { "user-1": "buyer@example.com" },
    ...seed,
  };

  const client = {
    state,
    auth: {
      admin: {
        getUserById: vi.fn(async (userId: string) => ({
          data: { user: { email: state.userEmails[userId] } },
          error: null,
        })),
      },
    },
    from(table: TableName) {
      const filters: Array<[string, unknown]> = [];
      const inFilters: Array<[string, unknown[]]> = [];
      const lteFilters: Array<[string, string]> = [];
      let rowLimit: number | undefined;
      let operation:
        | { type: "select" }
        | { type: "upsert"; rows: DunningScheduleRow[]; options?: Row }
        | { type: "update"; patch: Row } = { type: "select" };

      const matchingRows = () =>
        state[table]
          .filter((row) =>
            filters.every(([column, value]) => (row as Row)[column] === value),
          )
          .filter((row) =>
            inFilters.every(([column, values]) =>
              values.includes((row as Row)[column]),
            ),
          )
          .filter((row) =>
            lteFilters.every(
              ([column, value]) => String((row as Row)[column]) <= value,
            ),
          )
          .slice(0, rowLimit);

      const execute = async () => {
        const currentOperation = operation;

        if (currentOperation.type === "upsert") {
          const rows = currentOperation.rows;
          const ignoreDuplicates =
            currentOperation.options?.ignoreDuplicates === true;

          for (const row of rows) {
            const existing = state[table].find(
              (item) => item.idempotency_key === row.idempotency_key,
            );
            if (existing) {
              if (!ignoreDuplicates) Object.assign(existing, row);
            } else {
              state[table].push({
                ...row,
                id: `dunning-${state[table].length + 1}`,
              });
            }
          }

          return { data: rows, error: null };
        }

        if (currentOperation.type === "update") {
          const rows = matchingRows();
          rows.forEach((row) => Object.assign(row, currentOperation.patch));
          return { data: rows, error: null };
        }

        return { data: matchingRows(), error: null };
      };

      const builder = {
        select() {
          operation = { type: "select" };
          return builder;
        },
        upsert(rows: DunningScheduleRow[], options?: Row) {
          operation = { type: "upsert", rows, options };
          return builder;
        },
        update(patch: Row) {
          operation = { type: "update", patch };
          return builder;
        },
        eq(...args: [string, unknown]) {
          filters.push(args);
          return builder;
        },
        in(...args: [string, unknown[]]) {
          inFilters.push(args);
          return builder;
        },
        lte(...args: [string, string]) {
          lteFilters.push(args);
          return builder;
        },
        order() {
          return builder;
        },
        limit(limit: number) {
          rowLimit = limit;
          return builder;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: unknown) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return execute().then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };

  return client;
}

describe("Dunning scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T00:00:00.000Z"));
    emailClient.enqueueTransactionalTemplateEmail.mockResolvedValue({
      ok: true,
      messageId: "email-1",
    });
  });

  it("startDunning schedules D+1, D+3, and D+7 emails with stable idempotency keys", async () => {
    const supabase = createFakeSupabase();
    const scheduler = createDunningScheduler({ supabase: supabase as never });

    await scheduler.startDunning("in_failed", "user-1", "zh-TW");

    expect(supabase.state.dunning_schedules).toEqual([
      expect.objectContaining({
        stripe_invoice_id: "in_failed",
        user_id: "user-1",
        locale: "zh-TW",
        dunning_day: 1,
        template: "payment_failed_d1",
        idempotency_key: "dunning-in_failed-1",
        scheduled_for: "2026-05-22T00:00:00.000Z",
        status: "pending",
      }),
      expect.objectContaining({
        dunning_day: 3,
        template: "payment_failed_d3",
        idempotency_key: "dunning-in_failed-3",
        scheduled_for: "2026-05-24T00:00:00.000Z",
      }),
      expect.objectContaining({
        dunning_day: 7,
        template: "payment_failed_d7",
        idempotency_key: "dunning-in_failed-7",
        scheduled_for: "2026-05-28T00:00:00.000Z",
      }),
    ]);
  });

  it("startDunning is idempotent for the same Stripe invoice", async () => {
    const supabase = createFakeSupabase();
    const scheduler = createDunningScheduler({ supabase: supabase as never });

    await scheduler.startDunning("in_failed", "user-1", "en");
    await scheduler.startDunning("in_failed", "user-1", "en");

    expect(supabase.state.dunning_schedules).toHaveLength(3);
    expect(
      supabase.state.dunning_schedules.map((row) => row.idempotency_key),
    ).toEqual([
      "dunning-in_failed-1",
      "dunning-in_failed-3",
      "dunning-in_failed-7",
    ]);
  });

  it("cancelDunning cancels pending schedules for the invoice", async () => {
    const supabase = createFakeSupabase({
      dunning_schedules: [
        {
          stripe_invoice_id: "in_failed",
          user_id: "user-1",
          locale: "en",
          dunning_day: 1,
          template: "payment_failed_d1",
          idempotency_key: "dunning-in_failed-1",
          scheduled_for: "2026-05-22T00:00:00.000Z",
          status: "pending",
        },
        {
          stripe_invoice_id: "in_other",
          user_id: "user-1",
          locale: "en",
          dunning_day: 1,
          template: "payment_failed_d1",
          idempotency_key: "dunning-in_other-1",
          scheduled_for: "2026-05-22T00:00:00.000Z",
          status: "pending",
        },
      ],
    });
    const scheduler = createDunningScheduler({ supabase: supabase as never });

    await scheduler.cancelDunning("in_failed");

    expect(supabase.state.dunning_schedules[0]).toEqual(
      expect.objectContaining({
        status: "cancelled",
        cancellation_reason: "invoice_paid",
        cancelled_at: "2026-05-21T00:00:00.000Z",
      }),
    );
    expect(supabase.state.dunning_schedules[1].status).toBe("pending");
  });

  it("processDueDunningSchedules sends due rows through cf-email and marks them sent", async () => {
    const supabase = createFakeSupabase({
      dunning_schedules: [
        {
          id: "dunning-1",
          stripe_invoice_id: "in_failed",
          user_id: "user-1",
          locale: "en",
          dunning_day: 1,
          template: "payment_failed_d1",
          idempotency_key: "dunning-in_failed-1",
          scheduled_for: "2026-05-21T00:00:00.000Z",
          status: "pending",
        },
      ],
    });

    const result = await processDueDunningSchedules({
      supabase: supabase as never,
      now: new Date("2026-05-21T00:00:00.000Z"),
    });

    expect(emailClient.enqueueTransactionalTemplateEmail).toHaveBeenCalledWith({
      to: "buyer@example.com",
      template: "payment_failed_d1",
      idempotencyKey: "dunning-in_failed-1",
      context: {
        dunningDay: 1,
        locale: "en",
        stripeInvoiceId: "in_failed",
        userId: "user-1",
      },
    });
    expect(result).toEqual({ processed: 1, sent: 1, failed: 0, suppressed: 0 });
    expect(supabase.state.dunning_schedules[0]).toEqual(
      expect.objectContaining({
        status: "sent",
        sent_at: "2026-05-21T00:00:00.000Z",
      }),
    );
  });
});
