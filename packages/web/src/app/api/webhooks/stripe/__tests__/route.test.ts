import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeServer = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
}));

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

const emailClient = vi.hoisted(() => ({
  enqueueTransactionalTemplateEmail: vi.fn(),
}));

const amegoJob = vi.hoisted(() => ({
  enqueueAmegoInvoiceIssue: vi.fn(),
}));

const dunning = vi.hoisted(() => ({
  cancelDunning: vi.fn(),
  createDunningScheduler: vi.fn(),
  startDunning: vi.fn(),
}));

const analytics = vi.hoisted(() => ({
  captureTrialCardAdded: vi.fn(),
  captureTrialConverted: vi.fn(),
}));

vi.mock("@/lib/payments/stripe/server", () => stripeServer);
vi.mock("@shared/supabase", () => supabaseAdmin);
vi.mock("@/lib/email/cf-email-client", () => emailClient);
vi.mock("@/lib/payments/amego/job", () => amegoJob);
vi.mock("@/lib/payments/dunning/scheduler", () => dunning);
vi.mock("@/lib/analytics/posthog-server", () => analytics);

type Row = Record<string, unknown>;
type TableName =
  | "stripe_events"
  | "trials"
  | "company_subscriptions"
  | "invoices"
  | "subscription_plans";

type FakeState = {
  stripe_events: Row[];
  trials: Row[];
  company_subscriptions: Row[];
  invoices: Row[];
  subscription_plans: Row[];
  userEmails: Record<string, string>;
};

type Call = {
  table: string;
  method: string;
  args: unknown[];
};

const basePlan = {
  id: "plan_123",
  name: "Solo",
  slug: "solo",
  monthly_price: 29,
  yearly_price: null,
  yearly_discount: null,
  base_tokens: 1000,
  is_lifetime: false,
  lifetime_price: null,
  features: {},
  limits: {},
  articles_per_month: 10,
  yearly_bonus_months: 0,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

function request(event: unknown, signature = "sig_test") {
  return new Request("https://app.1wayseo.com/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: JSON.stringify(event),
  });
}

function stripeEvent(type: string, object: Row, id = `evt_${type}`) {
  return {
    id,
    object: "event",
    type,
    data: { object },
  };
}

function checkoutEvent(id = "evt_checkout") {
  return stripeEvent(
    "checkout.session.completed",
    {
      id: "cs_test_123",
      object: "checkout.session",
      customer: "cus_123",
      subscription: "sub_123",
      customer_email: "buyer@example.com",
      customer_details: {
        email: "buyer@example.com",
        address: { country: "TW" },
      },
      metadata: {
        userId: "user-1",
        companyId: "company-1",
        planSlug: "solo",
        trialDays: "14",
      },
      payment_method_details: {
        card: { brand: "visa", last4: "4242" },
      },
    },
    id,
  );
}

function subscriptionEvent(type: string, id = `evt_${type}`) {
  return stripeEvent(
    type,
    {
      id: "sub_123",
      object: "subscription",
      metadata: {
        userId: "user-1",
        companyId: "company-1",
        planId: "plan_123",
        userEmail: "buyer@example.com",
      },
    },
    id,
  );
}

function invoiceEvent(country: string, id = `evt_invoice_${country}`) {
  return stripeEvent(
    "invoice.paid",
    {
      id: `in_${country}`,
      object: "invoice",
      subscription: "sub_123",
      amount_paid: 2900,
      currency: "usd",
      customer_email: "buyer@example.com",
      customer_name: "Buyer Chen",
      customer_address: { country },
      status_transitions: { paid_at: 1_777_777_777 },
      metadata: {
        userId: "user-1",
        companyId: "company-1",
        planId: "plan_123",
        amountTwd: "899",
      },
      lines: {
        data: [
          {
            description: "1WaySEO Solo monthly subscription",
            quantity: 1,
            amount: 2900,
            currency: "usd",
          },
        ],
      },
    },
    id,
  );
}

function paymentFailedEvent() {
  return stripeEvent(
    "invoice.payment_failed",
    {
      id: "in_failed",
      object: "invoice",
      subscription: "sub_123",
      amount_due: 2900,
      customer_email: "buyer@example.com",
      customer_address: { country: "US" },
      metadata: {
        userId: "user-1",
        companyId: "company-1",
        planId: "plan_123",
      },
    },
    "evt_payment_failed",
  );
}

function createSeedState(): FakeState {
  return {
    stripe_events: [],
    trials: [],
    company_subscriptions: [],
    invoices: [],
    subscription_plans: [basePlan],
    userEmails: { "user-1": "buyer@example.com" },
  };
}

function seedActiveTrial(state: FakeState, country = "TW") {
  state.trials.push({
    id: "trial-1",
    user_id: "user-1",
    company_id: "company-1",
    plan_id: "plan_123",
    started_at: "2026-05-01T00:00:00.000Z",
    ends_at: "2026-06-01T00:00:00.000Z",
    converted_at: null,
    cancelled_at: null,
    stripe_subscription_id: "sub_123",
    card_brand: "visa",
    card_last4: "4242",
    created_at: "2026-05-01T00:00:00.000Z",
  });
  state.company_subscriptions.push({
    id: "sub-row-1",
    company_id: "company-1",
    plan_id: "plan_123",
    status: "trialing",
    purchased_token_balance: 0,
    monthly_quota_balance: 1000,
    monthly_token_quota: 1000,
    provider: "stripe",
    stripe_customer_id: "cus_123",
    stripe_subscription_id: "sub_123",
    billing_country: country,
    trial_ends_at: "2026-06-01T00:00:00.000Z",
  });
}

function createFakeSupabase(seed: Partial<FakeState> = {}) {
  const state: FakeState = { ...createSeedState(), ...seed };
  const calls: Call[] = [];

  const client = {
    state,
    calls,
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
      let operation:
        | { type: "insert"; row: Row }
        | { type: "update"; patch: Row }
        | { type: "upsert"; row: Row }
        | { type: "delete" }
        | { type: "select" } = { type: "select" };

      const execute = async () => {
        const currentOperation = operation;

        if (currentOperation.type === "insert") {
          const rowToInsert = currentOperation.row;
          if (
            table === "stripe_events" &&
            state.stripe_events.some(
              (row) => row.stripe_event_id === rowToInsert.stripe_event_id,
            )
          ) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate key value" },
            };
          }
          state[table].push({ ...rowToInsert });
          return { data: rowToInsert, error: null };
        }

        if (currentOperation.type === "upsert") {
          const rowToUpsert = currentOperation.row;
          const existing = state.company_subscriptions.find(
            (row) => row.company_id === rowToUpsert.company_id,
          );
          if (existing) {
            Object.assign(existing, rowToUpsert);
          } else {
            state.company_subscriptions.push({ ...rowToUpsert });
          }
          return { data: rowToUpsert, error: null };
        }

        if (currentOperation.type === "update") {
          const patch = currentOperation.patch;
          matchingRows(table, state, filters).forEach((row) => {
            Object.assign(row, patch);
          });
          return { data: null, error: null };
        }

        if (currentOperation.type === "delete") {
          const rows = matchingRows(table, state, filters);
          rows.forEach((row) => {
            const index = state[table].indexOf(row);
            if (index >= 0) state[table].splice(index, 1);
          });
          return { data: null, error: null };
        }

        return { data: matchingRows(table, state, filters), error: null };
      };

      const builder = {
        insert(row: Row) {
          calls.push({ table, method: "insert", args: [row] });
          operation = { type: "insert", row };
          return builder;
        },
        upsert(row: Row, options?: unknown) {
          calls.push({ table, method: "upsert", args: [row, options] });
          operation = { type: "upsert", row };
          return builder;
        },
        update(patch: Row) {
          calls.push({ table, method: "update", args: [patch] });
          operation = { type: "update", patch };
          return builder;
        },
        delete() {
          calls.push({ table, method: "delete", args: [] });
          operation = { type: "delete" };
          return builder;
        },
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          operation = { type: "select" };
          return builder;
        },
        eq(...args: [string, unknown]) {
          calls.push({ table, method: "eq", args });
          filters.push(args);
          return builder;
        },
        async single() {
          const result = await execute();
          return {
            data: Array.isArray(result.data)
              ? (result.data[0] ?? null)
              : result.data,
            error: result.error,
          };
        },
        async maybeSingle() {
          const result = await execute();
          return {
            data: Array.isArray(result.data)
              ? (result.data[0] ?? null)
              : result.data,
            error: result.error,
          };
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

function matchingRows(
  table: TableName,
  state: FakeState,
  filters: Array<[string, unknown]>,
) {
  return state[table].filter((row) =>
    filters.every(([column, value]) => row[column] === value),
  );
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T00:00:00.000Z"));
    emailClient.enqueueTransactionalTemplateEmail.mockResolvedValue({
      ok: true,
      messageId: "email-1",
    });
    dunning.startDunning.mockResolvedValue(undefined);
    dunning.cancelDunning.mockResolvedValue(undefined);
    dunning.createDunningScheduler.mockReturnValue({
      startDunning: dunning.startDunning,
      cancelDunning: dunning.cancelDunning,
    });
    stripeServer.getStripeClient.mockReturnValue({
      verifyWebhookSignature: vi.fn((rawBody: string) => JSON.parse(rawBody)),
    });
  });

  it("returns 400 for a bad signature", async () => {
    stripeServer.getStripeClient.mockReturnValue({
      verifyWebhookSignature: vi.fn(() => {
        throw new Error("bad signature");
      }),
    });
    const { POST } = await import("../route");

    const response = await POST(request(checkoutEvent()) as never);

    expect(response.status).toBe(400);
    expect(supabaseAdmin.createAdminClient).not.toHaveBeenCalled();
  });

  it("dedupes duplicate event ids with no second processing mutation", async () => {
    const supabase = createFakeSupabase();
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const event = checkoutEvent("evt_dupe");
    const { POST } = await import("../route");

    const first = await POST(request(event) as never);
    const second = await POST(request(event) as never);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(supabase.state.trials).toHaveLength(1);
    expect(supabase.state.company_subscriptions).toHaveLength(1);
    expect(analytics.captureTrialCardAdded).toHaveBeenCalledTimes(1);
  });

  it("handles checkout.session.completed by inserting trial and upserting subscription", async () => {
    const supabase = createFakeSupabase();
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const { POST } = await import("../route");

    const response = await POST(request(checkoutEvent()) as never);

    expect(response.status).toBe(200);
    expect(supabase.state.trials[0]).toMatchObject({
      user_id: "user-1",
      company_id: "company-1",
      plan_id: "plan_123",
      stripe_subscription_id: "sub_123",
      card_brand: "visa",
      card_last4: "4242",
    });
    expect(supabase.state.company_subscriptions[0]).toMatchObject({
      company_id: "company-1",
      provider: "stripe",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      billing_country: "TW",
      status: "trialing",
    });
    expect(analytics.captureTrialCardAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        cardBrand: "visa",
      }),
    );
  });

  it("handles customer.subscription.trial_will_end by sending trial_d3 email", async () => {
    const state = createSeedState();
    seedActiveTrial(state);
    const supabase = createFakeSupabase(state);
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const { POST } = await import("../route");

    const response = await POST(
      request(
        subscriptionEvent("customer.subscription.trial_will_end"),
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(emailClient.enqueueTransactionalTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        template: "trial_d3",
        idempotencyKey:
          "stripe:evt_customer.subscription.trial_will_end:trial_d3",
      }),
    );
  });

  it("handles invoice.paid for TW billing with pending Amego status", async () => {
    const state = createSeedState();
    seedActiveTrial(state, "TW");
    const supabase = createFakeSupabase(state);
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const { POST } = await import("../route");

    const response = await POST(request(invoiceEvent("TW")) as never);

    expect(response.status).toBe(200);
    expect(supabase.state.invoices[0]).toMatchObject({
      stripe_invoice_id: "in_TW",
      amount_usd: 29,
      amount_twd: 899,
      billing_country: "TW",
      amego_status: "pending",
    });
    expect(amegoJob.enqueueAmegoInvoiceIssue).toHaveBeenCalledWith({
      supabase,
      payload: expect.objectContaining({
        stripeInvoiceId: "in_TW",
        amountUsd: 29,
        amountTwd: 899,
        buyer: expect.objectContaining({
          name: "Buyer Chen",
          email: "buyer@example.com",
          country: "TW",
        }),
      }),
    });
    expect(supabase.state.trials[0].converted_at).toBeTruthy();
    expect(supabase.state.company_subscriptions[0].status).toBe("active");
    expect(dunning.cancelDunning).toHaveBeenCalledWith("in_TW");
    expect(analytics.captureTrialConverted).toHaveBeenCalledWith(
      expect.objectContaining({ amountUsd: 29, trialId: "trial-1" }),
    );
  });

  it("handles invoice.paid for non-TW billing with not_applicable Amego status", async () => {
    const state = createSeedState();
    seedActiveTrial(state, "US");
    const supabase = createFakeSupabase(state);
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const { POST } = await import("../route");

    const response = await POST(request(invoiceEvent("US")) as never);

    expect(response.status).toBe(200);
    expect(supabase.state.invoices[0]).toMatchObject({
      stripe_invoice_id: "in_US",
      amount_usd: 29,
      billing_country: "US",
      amego_status: "not_applicable",
    });
    expect(amegoJob.enqueueAmegoInvoiceIssue).not.toHaveBeenCalled();
  });

  it("handles invoice.payment_failed by marking past_due and starting dunning", async () => {
    const state = createSeedState();
    seedActiveTrial(state, "US");
    const supabase = createFakeSupabase(state);
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const { POST } = await import("../route");

    const response = await POST(request(paymentFailedEvent()) as never);

    expect(response.status).toBe(200);
    expect(supabase.state.company_subscriptions[0].status).toBe("past_due");
    expect(dunning.startDunning).toHaveBeenCalledWith(
      "in_failed",
      "user-1",
      "en",
    );
    expect(
      emailClient.enqueueTransactionalTemplateEmail,
    ).not.toHaveBeenCalled();
  });

  it("handles customer.subscription.deleted by cancelling the subscription row", async () => {
    const state = createSeedState();
    seedActiveTrial(state, "US");
    const supabase = createFakeSupabase(state);
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const { POST } = await import("../route");

    const response = await POST(
      request(subscriptionEvent("customer.subscription.deleted")) as never,
    );

    expect(response.status).toBe(200);
    expect(supabase.state.company_subscriptions[0].status).toBe("cancelled");
  });

  it("acknowledges unknown event types without domain mutations", async () => {
    const supabase = createFakeSupabase();
    supabaseAdmin.createAdminClient.mockReturnValue(supabase);
    const { POST } = await import("../route");

    const response = await POST(
      request(
        stripeEvent("customer.created", { id: "cus_123" }, "evt_unknown"),
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(supabase.state.stripe_events[0]).toMatchObject({
      stripe_event_id: "evt_unknown",
      event_type: "customer.created",
    });
    expect(supabase.state.stripe_events[0].processed_at).toBeTruthy();
    expect(supabase.state.trials).toHaveLength(0);
    expect(supabase.state.invoices).toHaveLength(0);
  });
});
