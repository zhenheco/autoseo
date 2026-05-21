import { beforeEach, describe, expect, it, vi } from "vitest";

type BrandRow = {
  id: string;
  company_id: string;
  name: string;
  voice_tone: string | null;
  target_audience: unknown | null;
  value_props: string[] | null;
  brand_guidelines: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  automation_level: number;
  auto_articles_per_week: number;
  auto_publish_to_social: boolean;
};

type PlanRow = {
  company_id: string;
  billing_cycle: "monthly" | "yearly";
  subscription_plans: {
    slug: "solo" | "pro";
  };
};

type Filter = {
  column: string;
  operator: "eq" | "is";
  value: unknown;
};

const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  company: "00000000-0000-4000-8000-000000000101",
  otherCompany: "00000000-0000-4000-8000-000000000202",
  brand1: "00000000-0000-4000-8000-000000001001",
  brand2: "00000000-0000-4000-8000-000000001002",
  brand3: "00000000-0000-4000-8000-000000001003",
  brand4: "00000000-0000-4000-8000-000000001004",
  brand5: "00000000-0000-4000-8000-000000001005",
  otherBrand: "00000000-0000-4000-8000-000000002001",
  unknownBrand: "00000000-0000-4000-8000-000000009999",
};

const state = vi.hoisted(() => ({
  companyId: "00000000-0000-4000-8000-000000000101",
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
        route?: { params: Promise<{ id: string }> },
      ) => Promise<Response> | Response,
    ) =>
      (request: Request, route?: { params: Promise<{ id: string }> }) =>
        handler(
          request,
          {
            authMode: "company",
            companyId: state.companyId,
            user: { id: ids.user },
            supabase: state.supabase!,
          },
          route,
        ),
  ),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

function brand(overrides: Partial<BrandRow>): BrandRow {
  return {
    id: ids.brand1,
    company_id: ids.company,
    name: "Acme",
    voice_tone: null,
    target_audience: null,
    value_props: null,
    brand_guidelines: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    is_default: false,
    created_at: "2026-05-21T00:00:00.000Z",
    updated_at: "2026-05-21T00:00:00.000Z",
    deleted_at: null,
    automation_level: 1,
    auto_articles_per_week: 0,
    auto_publish_to_social: false,
    ...overrides,
  };
}

function plan(
  companyId: string,
  slug: "solo" | "pro",
  billingCycle: "monthly" | "yearly" = "monthly",
): PlanRow {
  return {
    company_id: companyId,
    billing_cycle: billingCycle,
    subscription_plans: {
      slug,
    },
  };
}

class FakeQueryBuilder {
  private readonly filters: Filter[] = [];
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private insertPayload: Record<string, unknown> | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private headCount = false;

  constructor(
    private readonly db: FakeSupabaseClient,
    private readonly table: string,
  ) {}

  select(_columns?: string, options?: { count?: "exact"; head?: boolean }) {
    this.operation = this.operation === "insert" ? "insert" : this.operation;
    this.headCount = Boolean(options?.head && options.count === "exact");
    return this;
  }

  insert(payload: Record<string, unknown>) {
    this.operation = "insert";
    this.insertPayload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation = "update";
    this.updatePayload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, operator: "is", value });
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    const result = this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    return Promise.resolve({
      data: rows[0] ?? null,
      error: null,
    });
  }

  single() {
    const result = this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];

    if (rows.length === 0) {
      return Promise.resolve({
        data: null,
        error: { message: "No rows" },
      });
    }

    return Promise.resolve({
      data: rows[0],
      error: null,
    });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    if (this.table === "brands") {
      return this.executeBrands();
    }

    if (this.table === "company_subscriptions") {
      return {
        data: this.db.plans.filter((row) => this.matches(row)),
        error: null,
      };
    }

    return { data: [], error: null };
  }

  private executeBrands(): QueryResult {
    if (this.operation === "insert" && this.insertPayload) {
      const now = "2026-05-21T12:00:00.000Z";
      const created = brand({
        id: `00000000-0000-4000-8000-${String(this.db.brands.length + 3001).padStart(12, "0")}`,
        company_id: String(this.insertPayload.company_id),
        name: String(this.insertPayload.name),
        voice_tone: valueOrNull(this.insertPayload.voice_tone),
        target_audience: this.insertPayload.target_audience ?? null,
        value_props: Array.isArray(this.insertPayload.value_props)
          ? this.insertPayload.value_props.map(String)
          : null,
        brand_guidelines: valueOrNull(this.insertPayload.brand_guidelines),
        logo_url: valueOrNull(this.insertPayload.logo_url),
        primary_color: valueOrNull(this.insertPayload.primary_color),
        secondary_color: valueOrNull(this.insertPayload.secondary_color),
        created_at: now,
        updated_at: now,
      });
      this.db.brands.push(created);
      return { data: [created], error: null };
    }

    if (this.operation === "update" && this.updatePayload) {
      const rows = this.db.brands.filter((row) => this.matches(row));
      rows.forEach((row) => {
        Object.assign(row, this.updatePayload);
      });
      return { data: rows, error: null };
    }

    const rows = this.db.brands.filter((row) => this.matches(row));

    if (this.headCount) {
      return {
        data: null,
        error: null,
        count: rows.length,
      };
    }

    return { data: rows, error: null };
  }

  private matches(row: Record<string, unknown>) {
    return this.filters.every((filter) => {
      if (filter.operator === "is") {
        return row[filter.column] === filter.value;
      }
      return row[filter.column] === filter.value;
    });
  }
}

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
};

class FakeSupabaseClient {
  constructor(
    readonly brands: BrandRow[],
    readonly plans: PlanRow[],
  ) {}

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }
}

function valueOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function jsonRequest(body: unknown) {
  return new Request("https://example.com/api/brands", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function routeParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("Brand CRUD API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.companyId = ids.company;
    state.supabase = new FakeSupabaseClient(
      [],
      [plan(ids.company, "solo"), plan(ids.otherCompany, "pro")],
    );
  });

  it("declares all Brand routes as company scoped", async () => {
    await import("../route");
    await import("../[id]/route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(routeAuth.withRouteAuth).toHaveBeenCalledTimes(5);
  });

  it("creates the first Solo brand", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      jsonRequest({
        name: "Acme",
        voiceTone: "practical",
        targetAudience: { description: "Founders" },
        valueProps: ["Fast SEO"],
        brandGuidelines: "Use concise language.",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#0057ff",
        secondaryColor: "#ffcc00",
      }) as never,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        name: "Acme",
        company_id: ids.company,
        voice_tone: "practical",
        target_audience: { description: "Founders" },
        value_props: ["Fast SEO"],
        brand_guidelines: "Use concise language.",
        logo_url: "https://example.com/logo.png",
        primary_color: "#0057ff",
        secondary_color: "#ffcc00",
        deleted_at: null,
      },
    });
  });

  it("returns 402 when Solo already has one active brand", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.brand1 })],
      [plan(ids.company, "solo")],
    );
    const { POST } = await import("../route");

    const response = await POST(jsonRequest({ name: "Second" }) as never);

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "quota_exceeded",
      currentPlan: "solo_monthly",
      brandsUsed: 1,
      brandsCap: 1,
      upgradeUrl: "/dashboard/billing",
    });
  });

  it("returns 402 when Pro already has five active brands", async () => {
    state.supabase = new FakeSupabaseClient(
      [ids.brand1, ids.brand2, ids.brand3, ids.brand4, ids.brand5].map((id) =>
        brand({ id }),
      ),
      [plan(ids.company, "pro")],
    );
    const { POST } = await import("../route");

    const response = await POST(jsonRequest({ name: "Sixth" }) as never);

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      error: "quota_exceeded",
      currentPlan: "pro_monthly",
      brandsUsed: 5,
      brandsCap: 5,
    });
  });

  it("lists only active brands for the current company", async () => {
    state.supabase = new FakeSupabaseClient(
      [
        brand({ id: ids.brand1, name: "Visible" }),
        brand({ id: ids.otherBrand, company_id: ids.otherCompany }),
        brand({
          id: ids.brand2,
          name: "Deleted",
          deleted_at: "2026-05-21T12:00:00.000Z",
        }),
      ],
      [plan(ids.company, "solo")],
    );
    const { GET } = await import("../route");

    const response = await GET(
      new Request("https://example.com/api/brands") as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: ids.brand1, name: "Visible" }],
    });
  });

  it("patches documented fields", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.brand1 })],
      [plan(ids.company, "solo")],
    );
    const { PATCH } = await import("../[id]/route");

    const response = await PATCH(
      jsonRequest({
        name: "Acme Updated",
        voiceTone: "direct",
        valueProps: ["Reliable content"],
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#123abc",
        secondaryColor: "#fedcba",
      }) as never,
      routeParams(ids.brand1),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: ids.brand1,
        name: "Acme Updated",
        voice_tone: "direct",
        value_props: ["Reliable content"],
        logo_url: "https://example.com/logo.png",
        primary_color: "#123abc",
        secondary_color: "#fedcba",
      },
    });
  });

  it("patches brand automation settings", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.brand1 })],
      [plan(ids.company, "solo")],
    );
    const { PATCH } = await import("../[id]/route");

    const response = await PATCH(
      jsonRequest({
        automationLevel: 3,
        autoArticlesPerWeek: 7,
        autoPublishToSocial: true,
      }) as never,
      routeParams(ids.brand1),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: ids.brand1,
        automation_level: 3,
        auto_articles_per_week: 7,
        auto_publish_to_social: true,
      },
    });
  });

  it("rejects automation settings outside supported bounds", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.brand1 })],
      [plan(ids.company, "solo")],
    );
    const { PATCH } = await import("../[id]/route");

    const response = await PATCH(
      jsonRequest({
        automationLevel: 5,
        autoArticlesPerWeek: 15,
      }) as never,
      routeParams(ids.brand1),
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid color and logo URL values", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.brand1 })],
      [plan(ids.company, "solo")],
    );
    const { PATCH } = await import("../[id]/route");

    const response = await PATCH(
      jsonRequest({
        primaryColor: "blue",
        logoUrl: "not-a-url",
      }) as never,
      routeParams(ids.brand1),
    );

    expect(response.status).toBe(400);
  });

  it("soft-deletes a brand and removes it from the list", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.brand1 })],
      [plan(ids.company, "solo")],
    );
    const detailRoute = await import("../[id]/route");
    const listRoute = await import("../route");

    const response = await detailRoute.DELETE(
      new Request(`https://example.com/api/brands/${ids.brand1}`) as never,
      routeParams(ids.brand1),
    );

    expect(response.status).toBe(200);
    expect(state.supabase.brands[0]?.deleted_at).toEqual(expect.any(String));

    const listResponse = await listRoute.GET(
      new Request("https://example.com/api/brands") as never,
    );
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      data: [],
    });
  });

  it("returns 404 for an unknown brand id", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.brand1 })],
      [plan(ids.company, "solo")],
    );
    const { GET } = await import("../[id]/route");

    const response = await GET(
      new Request(
        `https://example.com/api/brands/${ids.unknownBrand}`,
      ) as never,
      routeParams(ids.unknownBrand),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for a brand in another company", async () => {
    state.supabase = new FakeSupabaseClient(
      [brand({ id: ids.otherBrand, company_id: ids.otherCompany })],
      [plan(ids.company, "solo")],
    );
    const { GET } = await import("../[id]/route");

    const response = await GET(
      new Request(`https://example.com/api/brands/${ids.otherBrand}`) as never,
      routeParams(ids.otherBrand),
    );

    expect(response.status).toBe(404);
  });
});
