#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

type StripeMode = "test" | "live";
type ProductKey = "solo" | "pro";
type PriceKey = "solo_monthly" | "solo_yearly" | "pro_monthly" | "pro_yearly";
type RecurringInterval = "month" | "year";

interface ProductRecord {
  id: string;
  name: string;
  description?: string | null;
}

interface PriceProductRecord {
  id: string;
}

interface PriceRecord {
  id: string;
  lookup_key?: string | null;
  unit_amount?: number | null;
  currency: string;
  product: string | PriceProductRecord | null;
  recurring?: {
    interval?: string | null;
  } | null;
  tax_behavior?: string | null;
}

interface ListResponse<T> {
  data: T[];
}

export interface StripeSetupClient {
  products: {
    list(params: { limit: number }): Promise<ListResponse<ProductRecord>>;
    create(params: {
      name: string;
      description: string;
    }): Promise<ProductRecord>;
  };
  prices: {
    list(params: {
      lookup_keys: string[];
      limit: number;
    }): Promise<ListResponse<PriceRecord>>;
    create(params: {
      currency: "usd";
      product: string;
      unit_amount: number;
      lookup_key: PriceKey;
      recurring: { interval: RecurringInterval };
      tax_behavior: "exclusive";
    }): Promise<PriceRecord>;
  };
}

export interface SetupProductsPayload {
  mode: StripeMode;
  products: Record<ProductKey, string>;
  prices: Record<PriceKey, string>;
}

interface ProductConfig {
  key: ProductKey;
  name: string;
  description: string;
}

interface PriceConfig {
  key: PriceKey;
  productKey: ProductKey;
  unitAmount: number;
  interval: RecurringInterval;
}

interface SetupProductsOptions {
  mode: StripeMode;
  outputFilePath?: string;
  writeOutputFile?: boolean;
}

interface CliOptions {
  argv?: readonly string[];
  env?: NodeJS.ProcessEnv;
  stripeFactory?: (apiKey: string) => StripeSetupClient;
  outputFilePath?: string;
  writeOutputFile?: boolean;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

interface CliResult {
  exitCode: number;
  payload?: SetupProductsPayload;
}

const PRODUCT_CONFIGS: readonly ProductConfig[] = [
  {
    key: "solo",
    name: "Solo",
    description: "1wayseo Solo plan — 30 articles/month, 1 brand",
  },
  {
    key: "pro",
    name: "Pro",
    description:
      "1wayseo Pro plan — 200 articles/month, 5 brands, advanced analytics",
  },
];

const PRICE_CONFIGS: readonly PriceConfig[] = [
  {
    key: "solo_monthly",
    productKey: "solo",
    unitAmount: 3900,
    interval: "month",
  },
  {
    key: "solo_yearly",
    productKey: "solo",
    unitAmount: 37400,
    interval: "year",
  },
  {
    key: "pro_monthly",
    productKey: "pro",
    unitAmount: 9900,
    interval: "month",
  },
  {
    key: "pro_yearly",
    productKey: "pro",
    unitAmount: 95000,
    interval: "year",
  },
];

export function detectStripeMode(apiKey: string): StripeMode {
  if (apiKey.startsWith("sk_test_")) {
    return "test";
  }

  if (apiKey.startsWith("sk_live_")) {
    return "live";
  }

  throw new Error("STRIPE_API_KEY must start with sk_test_ or sk_live_.");
}

export function createStripeSetupClient(apiKey: string): StripeSetupClient {
  const stripe = new Stripe(apiKey);

  return {
    products: {
      list: (params) => stripe.products.list(params),
      create: (params) => stripe.products.create(params),
    },
    prices: {
      list: (params) => stripe.prices.list(params),
      create: (params) => stripe.prices.create(params),
    },
  };
}

export function getDefaultOutputFilePath(mode: StripeMode): string {
  const currentFilePath = fileURLToPath(import.meta.url);
  const webRoot = path.resolve(path.dirname(currentFilePath), "../..");

  return path.join(webRoot, `.stripe-price-ids.${mode}.json`);
}

export async function setupProducts(
  stripe: StripeSetupClient,
  options: SetupProductsOptions,
): Promise<SetupProductsPayload> {
  const productIds = await ensureProducts(stripe);
  const priceIds = await ensurePrices(stripe, productIds);

  const payload: SetupProductsPayload = {
    mode: options.mode,
    products: {
      solo: productIds.solo,
      pro: productIds.pro,
    },
    prices: {
      solo_monthly: priceIds.solo_monthly,
      solo_yearly: priceIds.solo_yearly,
      pro_monthly: priceIds.pro_monthly,
      pro_yearly: priceIds.pro_yearly,
    },
  };

  if (options.writeOutputFile !== false) {
    const outputFilePath =
      options.outputFilePath ?? getDefaultOutputFilePath(options.mode);
    await mkdir(path.dirname(outputFilePath), { recursive: true });
    await writeFile(
      outputFilePath,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
  }

  return payload;
}

export async function runCli(options: CliOptions = {}): Promise<CliResult> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;
  const apiKey = env.STRIPE_API_KEY;

  if (!apiKey) {
    stderr(
      "Missing STRIPE_API_KEY. Inject it from 1Password with op run before running this script.",
    );
    return { exitCode: 1 };
  }

  let mode: StripeMode;
  try {
    mode = detectStripeMode(apiKey);
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return { exitCode: 1 };
  }

  stderr(`Mode: ${mode}`);

  if (mode === "live" && !argv.includes("--confirm-live")) {
    stderr(
      "Live Stripe key detected. Re-run with --confirm-live to mutate the live account.",
    );
    return { exitCode: 1 };
  }

  try {
    const stripe = (options.stripeFactory ?? createStripeSetupClient)(apiKey);
    const payload = await setupProducts(stripe, {
      mode,
      outputFilePath: options.outputFilePath,
      writeOutputFile: options.writeOutputFile,
    });

    stdout(JSON.stringify(payload, null, 2));
    return { exitCode: 0, payload };
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return { exitCode: 1 };
  }
}

async function ensureProducts(
  stripe: StripeSetupClient,
): Promise<Record<ProductKey, string>> {
  const existingProducts = await stripe.products.list({ limit: 100 });
  const productIds = {} as Record<ProductKey, string>;

  for (const productConfig of PRODUCT_CONFIGS) {
    const existingProduct = existingProducts.data.find(
      (product) => product.name === productConfig.name,
    );

    if (existingProduct) {
      productIds[productConfig.key] = existingProduct.id;
      continue;
    }

    const createdProduct = await stripe.products.create({
      name: productConfig.name,
      description: productConfig.description,
    });
    productIds[productConfig.key] = createdProduct.id;
  }

  return productIds;
}

async function ensurePrices(
  stripe: StripeSetupClient,
  productIds: Record<ProductKey, string>,
): Promise<Record<PriceKey, string>> {
  const priceIds = {} as Record<PriceKey, string>;

  for (const priceConfig of PRICE_CONFIGS) {
    const listedPrices = await stripe.prices.list({
      lookup_keys: [priceConfig.key],
      limit: 1,
    });
    const existingPrice = listedPrices.data[0];

    if (existingPrice) {
      assertPriceMatchesConfig(
        existingPrice,
        priceConfig,
        productIds[priceConfig.productKey],
      );
      priceIds[priceConfig.key] = existingPrice.id;
      continue;
    }

    const createdPrice = await stripe.prices.create({
      currency: "usd",
      product: productIds[priceConfig.productKey],
      unit_amount: priceConfig.unitAmount,
      lookup_key: priceConfig.key,
      recurring: { interval: priceConfig.interval },
      tax_behavior: "exclusive",
    });
    priceIds[priceConfig.key] = createdPrice.id;
  }

  return priceIds;
}

function assertPriceMatchesConfig(
  price: PriceRecord,
  priceConfig: PriceConfig,
  expectedProductId: string,
): void {
  const actualProductId = getPriceProductId(price.product);

  if (price.unit_amount !== priceConfig.unitAmount) {
    throw new Error(
      `Existing Stripe price ${price.id} for lookup_key ${priceConfig.key} has unit_amount ${formatNullableNumber(
        price.unit_amount,
      )}; expected ${priceConfig.unitAmount}. Create a new lookup_key or fix the Stripe account manually.`,
    );
  }

  if (price.currency.toLowerCase() !== "usd") {
    throw new Error(
      `Existing Stripe price ${price.id} for lookup_key ${priceConfig.key} has currency ${price.currency}; expected usd.`,
    );
  }

  if (actualProductId !== expectedProductId) {
    throw new Error(
      `Existing Stripe price ${price.id} for lookup_key ${priceConfig.key} is attached to product ${formatNullableString(
        actualProductId,
      )}; expected ${expectedProductId}.`,
    );
  }

  if (price.recurring?.interval !== priceConfig.interval) {
    throw new Error(
      `Existing Stripe price ${price.id} for lookup_key ${priceConfig.key} has recurring interval ${formatNullableString(
        price.recurring?.interval,
      )}; expected ${priceConfig.interval}.`,
    );
  }

  if (price.tax_behavior !== "exclusive") {
    throw new Error(
      `Existing Stripe price ${price.id} for lookup_key ${priceConfig.key} has tax_behavior ${formatNullableString(
        price.tax_behavior,
      )}; expected exclusive.`,
    );
  }
}

function getPriceProductId(product: PriceRecord["product"]): string | null {
  if (!product) {
    return null;
  }

  if (typeof product === "string") {
    return product;
  }

  return product.id;
}

function formatNullableNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "null" : String(value);
}

function formatNullableString(value: string | null | undefined): string {
  return value === null || value === undefined ? "null" : value;
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  runCli().then((result) => {
    process.exitCode = result.exitCode;
  });
}
