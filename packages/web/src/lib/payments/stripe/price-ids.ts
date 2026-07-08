import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const STRIPE_PLAN_IDS = [
  "solo_monthly",
  "solo_yearly",
  "pro_monthly",
  "pro_yearly",
] as const;

export type StripePlanId = (typeof STRIPE_PLAN_IDS)[number];
export type StripePriceIdMode = "test" | "live";
export type StripeBillingCycle = "monthly" | "yearly";
export type SubscriptionPlanSlug = "starter" | "pro";

type PriceIdMap = Record<StripePlanId, string>;

interface PriceIdFilePayload {
  prices?: Partial<Record<StripePlanId, unknown>>;
}

interface LoadPriceIdMapOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  mode?: StripePriceIdMode;
}

const envKeys = {
  solo_monthly: "STRIPE_PRICE_SOLO_MONTHLY",
  solo_yearly: "STRIPE_PRICE_SOLO_YEARLY",
  pro_monthly: "STRIPE_PRICE_PRO_MONTHLY",
  pro_yearly: "STRIPE_PRICE_PRO_YEARLY",
} satisfies Record<StripePlanId, string>;

let cachedMap: PriceIdMap | null = null;

export function isStripePlanId(plan: string): plan is StripePlanId {
  return STRIPE_PLAN_IDS.includes(plan as StripePlanId);
}

export function getPriceId(plan: StripePlanId): string {
  cachedMap ??= loadPriceIdMap();
  return cachedMap[plan];
}

export function getSubscriptionPlanSlug(
  plan: StripePlanId,
): SubscriptionPlanSlug {
  return plan.startsWith("pro_") ? "pro" : "starter";
}

export function getBillingCycleFromPlanId(
  plan: StripePlanId,
): StripeBillingCycle {
  return plan.endsWith("_yearly") ? "yearly" : "monthly";
}

export function loadPriceIdMap(
  options: LoadPriceIdMapOptions = {},
): PriceIdMap {
  const env = options.env ?? process.env;
  const mode = options.mode ?? detectStripePriceIdMode(env);
  const fileMap = loadPriceIdFile(mode, options.cwd ?? process.cwd());

  return STRIPE_PLAN_IDS.reduce<PriceIdMap>((acc, plan) => {
    const fileValue = fileMap?.[plan];
    const envValue = env[envKeys[plan]];
    const value = fileValue || envValue;

    if (!value) {
      throw new Error(
        `Missing Stripe price id for ${plan}. Add .stripe-price-ids.${mode}.json or set ${envKeys[plan]}.`,
      );
    }

    acc[plan] = value;
    return acc;
  }, {} as PriceIdMap);
}

function detectStripePriceIdMode(env: NodeJS.ProcessEnv): StripePriceIdMode {
  const explicitMode = env.STRIPE_PRICE_ID_MODE ?? env.STRIPE_MODE;
  if (explicitMode === "live" || explicitMode === "test") {
    return explicitMode;
  }

  const apiKey = env.STRIPE_API_KEY ?? env.STRIPE_API_KEY_TEST;
  return apiKey?.startsWith("sk_live_") ? "live" : "test";
}

function loadPriceIdFile(
  mode: StripePriceIdMode,
  cwd: string,
): Partial<Record<StripePlanId, string>> | null {
  const fileName = `.stripe-price-ids.${mode}.json`;
  const candidates = [
    path.join(cwd, fileName),
    path.join(cwd, "packages/web", fileName),
    path.resolve(cwd, "..", fileName),
  ];

  const filePath = candidates.find((candidate) => existsSync(candidate));
  if (!filePath) return null;

  const payload = JSON.parse(
    readFileSync(filePath, "utf8"),
  ) as PriceIdFilePayload;
  const prices = payload.prices ?? {};

  return STRIPE_PLAN_IDS.reduce<Partial<Record<StripePlanId, string>>>(
    (acc, plan) => {
      const value = prices[plan];
      if (typeof value === "string" && value.length > 0) {
        acc[plan] = value;
      }
      return acc;
    },
    {},
  );
}
