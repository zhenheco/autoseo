import { describe, expect, it } from "vitest";
import { createQuotaEnforcer, type SupabaseServerClient } from "../enforcer";

type QuotaRow = {
  company_id: string;
  resource: string;
  month_bucket: string;
  used: number;
};

type WebsiteRow = {
  company_id: string;
  brand_id: string;
};

type Filter = {
  column: string;
  value: unknown;
};

class FakeSupabase {
  readonly quotaRows: QuotaRow[];
  readonly websiteRows: WebsiteRow[];

  constructor(input: { quotaRows?: QuotaRow[]; websiteRows?: WebsiteRow[] }) {
    this.quotaRows = input.quotaRows ?? [];
    this.websiteRows = input.websiteRows ?? [];
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(name: string, params: Record<string, unknown>) {
    if (name !== "quota_consume_atomic") {
      return {
        data: null,
        error: { message: `unexpected rpc: ${name}` },
      };
    }

    const companyId = String(params.p_company_id);
    const resource = String(params.p_resource);
    const amount = Number(params.p_amount);
    const cap = Number(params.p_cap);
    const monthBucket =
      resource === "brands" || resource === "websites"
        ? "1970-01-01"
        : currentMonthBucket();

    const row = this.quotaRows.find(
      (candidate) =>
        candidate.company_id === companyId &&
        candidate.resource === resource &&
        candidate.month_bucket === monthBucket,
    );
    const used = row?.used ?? 0;

    if (used + amount > cap) {
      return {
        data: [{ allowed: false, used }],
        error: null,
      };
    }

    if (row) {
      row.used += amount;
    } else {
      this.quotaRows.push({
        company_id: companyId,
        resource,
        month_bucket: monthBucket,
        used: amount,
      });
    }

    return {
      data: [{ allowed: true, used: used + amount }],
      error: null,
    };
  }
}

class FakeQuery {
  private filters: Filter[] = [];
  private options: { count?: "exact"; head?: boolean } | undefined;

  constructor(
    private readonly supabase: FakeSupabase,
    private readonly table: string,
  ) {}

  select(_columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.options = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  maybeSingle() {
    const rows = this.rows();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: null,
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown[] | null;
          count: number | null;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const rows = this.rows();
    const value = {
      data: this.options?.head ? null : rows,
      count: this.options?.count === "exact" ? rows.length : null,
      error: null,
    };

    return Promise.resolve(value).then(onfulfilled, onrejected);
  }

  private rows() {
    const source =
      this.table === "quota_consumption"
        ? this.supabase.quotaRows
        : this.supabase.websiteRows;

    return source.filter((row) =>
      this.filters.every(
        (filter) => row[filter.column as keyof typeof row] === filter.value,
      ),
    );
  }
}

const companyId = "company-1";

function enforcerFor(input: {
  quotaRows?: QuotaRow[];
  websiteRows?: WebsiteRow[];
  plan?: "solo" | "pro";
}) {
  return createQuotaEnforcer({
    supabase: new FakeSupabase(input) as unknown as SupabaseServerClient,
    resolvePlan: async () => input.plan ?? "solo",
  });
}

function currentMonthBucket() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-01`;
}

describe("createQuotaEnforcer", () => {
  it("allows solo articles when no monthly usage exists", async () => {
    const enforcer = enforcerFor({});

    await expect(
      enforcer.canConsume(companyId, "articles", 1),
    ).resolves.toMatchObject({
      allowed: true,
      used: 0,
      cap: 30,
      remaining: 30,
      plan: "solo",
      resource: "articles",
    });
  });

  it("rejects solo articles when amount would exceed the monthly cap", async () => {
    const enforcer = enforcerFor({
      quotaRows: [
        {
          company_id: companyId,
          resource: "articles",
          month_bucket: currentMonthBucket(),
          used: 29,
        },
      ],
    });

    await expect(
      enforcer.canConsume(companyId, "articles", 2),
    ).resolves.toMatchObject({
      allowed: false,
      used: 29,
      cap: 30,
      remaining: 1,
    });
  });

  it("allows solo articles when amount exactly reaches the monthly cap", async () => {
    const enforcer = enforcerFor({
      quotaRows: [
        {
          company_id: companyId,
          resource: "articles",
          month_bucket: currentMonthBucket(),
          used: 29,
        },
      ],
    });

    await expect(
      enforcer.canConsume(companyId, "articles", 1),
    ).resolves.toMatchObject({
      allowed: true,
      used: 29,
      cap: 30,
      remaining: 1,
    });
  });

  it("lets exactly one concurrent consume succeed at cap minus one", async () => {
    const enforcer = enforcerFor({
      quotaRows: [
        {
          company_id: companyId,
          resource: "articles",
          month_bucket: currentMonthBucket(),
          used: 29,
        },
      ],
    });

    const results = await Promise.all([
      enforcer.consume(companyId, "articles", 1),
      enforcer.consume(companyId, "articles", 1),
    ]);

    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toHaveLength(1);
    expect(results.map((result) => result.used)).toEqual([30, 30]);
  });

  it("checks websites against the per-brand cap instead of company total", async () => {
    const enforcer = enforcerFor({
      plan: "pro",
      websiteRows: [
        { company_id: companyId, brand_id: "brand-a" },
        { company_id: companyId, brand_id: "brand-b" },
        { company_id: companyId, brand_id: "brand-c" },
        { company_id: companyId, brand_id: "brand-d" },
        { company_id: companyId, brand_id: "brand-e" },
      ],
    });

    await expect(
      enforcer.canConsume(companyId, "websites", 1, { brandId: "brand-a" }),
    ).resolves.toMatchObject({
      allowed: true,
      used: 1,
      cap: 3,
      remaining: 2,
    });
  });

  it("returns usage for all quota resources", async () => {
    const enforcer = enforcerFor({
      quotaRows: [
        {
          company_id: companyId,
          resource: "articles",
          month_bucket: currentMonthBucket(),
          used: 12,
        },
        {
          company_id: companyId,
          resource: "cards",
          month_bucket: currentMonthBucket(),
          used: 34,
        },
        {
          company_id: companyId,
          resource: "brands",
          month_bucket: "1970-01-01",
          used: 1,
        },
      ],
      websiteRows: [
        { company_id: companyId, brand_id: "brand-a" },
        { company_id: companyId, brand_id: "brand-b" },
      ],
    });

    await expect(enforcer.getUsage(companyId)).resolves.toEqual({
      articles: { used: 12, cap: 30 },
      cards: { used: 34, cap: 100 },
      social_posts: { used: 0, cap: 100 },
      brands: { used: 1, cap: 1 },
      websites: { used: 1, cap: 1 },
      audits: { used: 0, cap: 10 },
    });
  });
});
