import { beforeEach, describe, expect, it, vi } from "vitest";

type MemberRow = {
  company_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type SubscriptionRow = {
  company_id: string;
  stripe_customer_id: string | null;
  updated_at: string;
};

type QueryRow = MemberRow | SubscriptionRow;

type Filter = {
  column: string;
  operator: "eq" | "not";
  value: unknown;
};

const state = vi.hoisted(() => ({
  userId: "user-owner",
  companyId: "company-1",
  supabase: null as FakeSupabaseClient | null,
}));

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (
      _mode: string,
      handler: (
        request: Request,
        context: {
          authMode: "company";
          companyId: string;
          user: { id: string };
          supabase: FakeSupabaseClient;
        },
      ) => Promise<Response> | Response,
    ) =>
      (request: Request) =>
        handler(request, {
          authMode: "company",
          companyId: state.companyId,
          user: { id: state.userId },
          supabase: state.supabase!,
        }),
  ),
}));

const stripe = vi.hoisted(() => ({
  createCustomerPortalSession: vi.fn(),
  getStripeClient: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/payments/stripe/server", () => ({
  getStripeClient: stripe.getStripeClient,
}));

class FakeQueryBuilder {
  private readonly filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;

  constructor(
    private readonly db: FakeSupabaseClient,
    private readonly table: string,
  ) {}

  select(columns?: string) {
    void columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  not(column: string, _operator: string, value: unknown) {
    this.filters.push({ column, operator: "not", value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    const rows = this.execute();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  private execute() {
    let rows: QueryRow[] =
      this.table === "company_members"
        ? [...this.db.members]
        : [...this.db.subscriptions];

    rows = rows.filter((row) =>
      this.filters.every((filter) => {
        const value = getRowValue(row, filter.column);
        if (filter.operator === "eq") return value === filter.value;
        return value !== filter.value;
      }),
    );

    if (this.orderBy) {
      rows.sort((a, b) => {
        const aValue = String(getRowValue(a, this.orderBy!.column) ?? "");
        const bValue = String(getRowValue(b, this.orderBy!.column) ?? "");
        return this.orderBy!.ascending
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows;
  }
}

function getRowValue(row: QueryRow, column: string) {
  return (row as Record<string, unknown>)[column];
}

class FakeSupabaseClient {
  constructor(
    readonly members: MemberRow[],
    readonly subscriptions: SubscriptionRow[],
  ) {}

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }
}

function createSupabase(input?: {
  members?: MemberRow[];
  subscriptions?: SubscriptionRow[];
}) {
  return new FakeSupabaseClient(
    input?.members ?? [
      {
        company_id: "company-1",
        user_id: "user-owner",
        role: "owner",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    input?.subscriptions ?? [
      {
        company_id: "company-1",
        stripe_customer_id: "cus_123",
        updated_at: "2026-05-20T00:00:00.000Z",
      },
    ],
  );
}

describe("stripe portal route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.userId = "user-owner";
    state.companyId = "company-1";
    state.supabase = createSupabase();
    stripe.createCustomerPortalSession.mockResolvedValue({
      url: "https://billing.stripe.com/session/test",
    });
    stripe.getStripeClient.mockReturnValue({
      createCustomerPortalSession: stripe.createCustomerPortalSession,
    });
  });

  it("returns a Stripe Customer Portal URL for the company owner", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://app.example.com/api/stripe/portal", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.com/session/test",
    });
    expect(stripe.createCustomerPortalSession).toHaveBeenCalledWith({
      stripeCustomerId: "cus_123",
      returnUrl: "/dashboard/settings",
    });
  });

  it("returns 403 when the current company member is not the owner", async () => {
    state.userId = "user-member";
    state.supabase = createSupabase({
      members: [
        {
          company_id: "company-1",
          user_id: "user-owner",
          role: "owner",
          created_at: "2026-05-01T00:00:00.000Z",
        },
        {
          company_id: "company-1",
          user_id: "user-member",
          role: "member",
          created_at: "2026-05-02T00:00:00.000Z",
        },
      ],
    });
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://app.example.com/api/stripe/portal", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(403);
    expect(stripe.createCustomerPortalSession).not.toHaveBeenCalled();
  });

  it("returns 404 when the company has no Stripe subscription customer", async () => {
    state.supabase = createSupabase({
      subscriptions: [
        {
          company_id: "company-1",
          stripe_customer_id: null,
          updated_at: "2026-05-20T00:00:00.000Z",
        },
      ],
    });
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://app.example.com/api/stripe/portal", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(404);
    expect(stripe.createCustomerPortalSession).not.toHaveBeenCalled();
  });
});
