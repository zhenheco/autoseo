import {
  ABSOLUTE_RESOURCES,
  MONTHLY_RESOURCES,
  PLAN_CAPS,
  type QuotaCaps,
} from "./caps";

export type QuotaPlan = keyof typeof PLAN_CAPS;
export type QuotaResource = keyof QuotaCaps;

export interface ConsumeContext {
  brandId?: string; // required for 'websites'
}

export interface CanConsumeResult {
  allowed: boolean;
  used: number;
  cap: number;
  remaining: number;
  plan: QuotaPlan;
  resource: string;
}

export interface QuotaEnforcer {
  canConsume(
    companyId: string,
    resource: QuotaResource,
    amount: number,
    ctx?: ConsumeContext,
  ): Promise<CanConsumeResult>;
  consume(
    companyId: string,
    resource: QuotaResource,
    amount: number,
    ctx?: ConsumeContext,
  ): Promise<CanConsumeResult>;
  getUsage(
    companyId: string,
  ): Promise<Record<QuotaResource, { used: number; cap: number }>>;
}

type SupabaseError = { message: string };

type SupabaseQueryResponse = {
  data: unknown;
  count?: number | null;
  error: SupabaseError | null;
};

type SupabaseSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseExecutableQuery = PromiseLike<SupabaseQueryResponse>;

type SupabaseFilterQuery = SupabaseExecutableQuery & {
  eq(column: string, value: unknown): SupabaseFilterQuery;
  maybeSingle(): PromiseLike<SupabaseSingleResponse>;
};

type SupabaseQueryBuilder = {
  select(
    columns?: string,
    options?: { count?: "exact"; head?: boolean },
  ): SupabaseFilterQuery;
};

export interface SupabaseServerClient {
  from(table: string): SupabaseQueryBuilder;
  rpc(
    functionName: string,
    params: Record<string, unknown>,
  ): PromiseLike<SupabaseQueryResponse>;
}

type QuotaConsumptionRow = {
  used: number;
};

type QuotaConsumeAtomicRow = {
  allowed: boolean;
  used: number;
};

type WebsiteBrandRow = {
  brand_id: string | null;
};

const ABSOLUTE_BUCKET = "1970-01-01";
const ALL_RESOURCES: readonly QuotaResource[] = [
  ...MONTHLY_RESOURCES,
  ...ABSOLUTE_RESOURCES,
];

export function createQuotaEnforcer(deps: {
  supabase: SupabaseServerClient;
  resolvePlan(companyId: string): Promise<QuotaPlan>;
}): QuotaEnforcer {
  return {
    async canConsume(companyId, resource, amount, ctx) {
      assertValidAmount(amount);

      const plan = await deps.resolvePlan(companyId);
      const cap = PLAN_CAPS[plan][resource];
      const used =
        resource === "websites"
          ? await readWebsiteUsage(
              deps.supabase,
              companyId,
              requireBrandId(resource, ctx),
            )
          : await readUsage(deps.supabase, companyId, resource, ctx);

      return buildResult({
        plan,
        resource,
        used,
        cap,
        amount,
      });
    },

    async consume(companyId, resource, amount, ctx) {
      assertValidAmount(amount);

      const plan = await deps.resolvePlan(companyId);
      const cap = PLAN_CAPS[plan][resource];

      if (resource === "websites") {
        return consumeWebsiteQuota({
          supabase: deps.supabase,
          companyId,
          amount,
          cap,
          plan,
          ctx,
        });
      }

      const { data, error } = await deps.supabase.rpc("quota_consume_atomic", {
        p_company_id: companyId,
        p_resource: resource,
        p_amount: amount,
        p_cap: cap,
      });

      if (error) {
        throw new Error(`quota_consume_failed: ${error.message}`);
      }

      const row = readRpcRow(data);
      return {
        allowed: row.allowed,
        used: row.used,
        cap,
        remaining: Math.max(cap - row.used, 0),
        plan,
        resource,
      };
    },

    async getUsage(companyId) {
      const plan = await deps.resolvePlan(companyId);
      const entries = await Promise.all(
        ALL_RESOURCES.map(async (resource) => {
          const used = await readUsage(deps.supabase, companyId, resource);
          return [resource, { used, cap: PLAN_CAPS[plan][resource] }] as const;
        }),
      );

      return Object.fromEntries(entries) as Record<
        QuotaResource,
        { used: number; cap: number }
      >;
    },
  };
}

async function consumeWebsiteQuota(input: {
  supabase: SupabaseServerClient;
  companyId: string;
  amount: number;
  cap: number;
  plan: QuotaPlan;
  ctx?: ConsumeContext;
}): Promise<CanConsumeResult> {
  const used = await readWebsiteUsage(
    input.supabase,
    input.companyId,
    requireBrandId("websites", input.ctx),
  );

  return buildResult({
    plan: input.plan,
    resource: "websites",
    used,
    cap: input.cap,
    amount: input.amount,
  });
}

function buildResult(input: {
  plan: QuotaPlan;
  resource: QuotaResource;
  used: number;
  cap: number;
  amount: number;
}): CanConsumeResult {
  return {
    allowed: input.used + input.amount <= input.cap,
    used: input.used,
    cap: input.cap,
    remaining: Math.max(input.cap - input.used, 0),
    plan: input.plan,
    resource: input.resource,
  };
}

async function readUsage(
  supabase: SupabaseServerClient,
  companyId: string,
  resource: QuotaResource,
  ctx?: ConsumeContext,
): Promise<number> {
  if (resource === "websites") {
    return readWebsiteUsage(supabase, companyId, ctx?.brandId);
  }

  return readQuotaConsumptionUsage(supabase, companyId, resource);
}

async function readQuotaConsumptionUsage(
  supabase: SupabaseServerClient,
  companyId: string,
  resource: Exclude<QuotaResource, "websites">,
): Promise<number> {
  const { data, error } = await supabase
    .from("quota_consumption")
    .select("used")
    .eq("company_id", companyId)
    .eq("resource", resource)
    .eq("month_bucket", bucketFor(resource))
    .maybeSingle();

  if (error) {
    throw new Error(`quota_usage_lookup_failed: ${error.message}`);
  }

  return isQuotaConsumptionRow(data) ? data.used : 0;
}

async function readWebsiteUsage(
  supabase: SupabaseServerClient,
  companyId: string,
  brandId?: string,
): Promise<number> {
  if (brandId) {
    const { count, error } = await supabase
      .from("website_configs")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("brand_id", brandId);

    if (error) {
      throw new Error(`quota_website_usage_lookup_failed: ${error.message}`);
    }

    return count ?? 0;
  }

  const { data, error } = await supabase
    .from("website_configs")
    .select("brand_id")
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`quota_website_usage_lookup_failed: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return 0;
  }

  const countsByBrand = data.filter(isWebsiteBrandRow).reduce((counts, row) => {
    if (row.brand_id) {
      counts.set(row.brand_id, (counts.get(row.brand_id) ?? 0) + 1);
    }
    return counts;
  }, new Map<string, number>());

  return Math.max(0, ...countsByBrand.values());
}

function readRpcRow(data: unknown): QuotaConsumeAtomicRow {
  const row = Array.isArray(data) ? data[0] : data;

  if (!isQuotaConsumeAtomicRow(row)) {
    throw new Error("quota_consume_failed: invalid rpc response");
  }

  return row;
}

function requireBrandId(resource: QuotaResource, ctx?: ConsumeContext): string {
  if (!ctx?.brandId) {
    throw new Error(`quota_context_missing_brand_id: ${resource}`);
  }

  return ctx.brandId;
}

function assertValidAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("quota_amount_must_be_positive_integer");
  }
}

function bucketFor(resource: Exclude<QuotaResource, "websites">): string {
  if (resource === "brands") {
    return ABSOLUTE_BUCKET;
  }

  return currentUtcMonthBucket();
}

function currentUtcMonthBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-01`;
}

function isQuotaConsumptionRow(value: unknown): value is QuotaConsumptionRow {
  return (
    isRecord(value) &&
    "used" in value &&
    typeof value.used === "number" &&
    Number.isInteger(value.used) &&
    value.used >= 0
  );
}

function isQuotaConsumeAtomicRow(
  value: unknown,
): value is QuotaConsumeAtomicRow {
  return (
    isRecord(value) &&
    typeof value.allowed === "boolean" &&
    typeof value.used === "number" &&
    Number.isInteger(value.used) &&
    value.used >= 0
  );
}

function isWebsiteBrandRow(value: unknown): value is WebsiteBrandRow {
  return (
    isRecord(value) &&
    "brand_id" in value &&
    (typeof value.brand_id === "string" || value.brand_id === null)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
