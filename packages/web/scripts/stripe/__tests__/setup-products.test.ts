import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  runCli,
  setupProducts,
  type SetupProductsPayload,
  type StripeSetupClient,
} from "../setup-products";

type ProductRecord = Awaited<
  ReturnType<StripeSetupClient["products"]["create"]>
>;
type PriceRecord = Awaited<ReturnType<StripeSetupClient["prices"]["create"]>>;

class MockStripeClient implements StripeSetupClient {
  readonly productCreates: ProductRecord[] = [];
  readonly priceCreates: PriceRecord[] = [];

  private readonly productsStore: ProductRecord[];
  private readonly pricesStore: PriceRecord[];

  constructor(
    options: { products?: ProductRecord[]; prices?: PriceRecord[] } = {},
  ) {
    this.productsStore = [...(options.products ?? [])];
    this.pricesStore = [...(options.prices ?? [])];
  }

  readonly products = {
    list: async (): Promise<{ data: ProductRecord[] }> => ({
      data: [...this.productsStore],
    }),
    create: async (params: {
      name: string;
      description: string;
    }): Promise<ProductRecord> => {
      const product: ProductRecord = {
        id: `prod_${params.name.toLowerCase()}`,
        name: params.name,
        description: params.description,
      };

      this.productsStore.push(product);
      this.productCreates.push(product);

      return product;
    },
  };

  readonly prices = {
    list: async (params: {
      lookup_keys: string[];
    }): Promise<{ data: PriceRecord[] }> => ({
      data: this.pricesStore.filter(
        (price) => price.lookup_key === params.lookup_keys[0],
      ),
    }),
    create: async (params: {
      currency: "usd";
      product: string;
      unit_amount: number;
      lookup_key: PriceRecord["lookup_key"];
      recurring: { interval: string };
      tax_behavior: "exclusive";
    }): Promise<PriceRecord> => {
      const price: PriceRecord = {
        id: `price_${params.lookup_key}`,
        lookup_key: params.lookup_key,
        unit_amount: params.unit_amount,
        currency: params.currency,
        product: params.product,
        recurring: params.recurring,
        tax_behavior: params.tax_behavior,
      };

      this.pricesStore.push(price);
      this.priceCreates.push(price);

      return price;
    },
  };
}

const existingProducts: Record<"solo" | "pro", ProductRecord> = {
  solo: {
    id: "prod_solo_existing",
    name: "Solo",
    description: "1wayseo Solo plan — 30 articles/month, 1 brand",
  },
  pro: {
    id: "prod_pro_existing",
    name: "Pro",
    description:
      "1wayseo Pro plan — 200 articles/month, 5 brands, advanced analytics",
  },
};

const expectedFirstRunPayload: SetupProductsPayload = {
  mode: "test",
  products: {
    solo: "prod_solo",
    pro: "prod_pro",
  },
  prices: {
    solo_monthly: "price_solo_monthly",
    solo_yearly: "price_solo_yearly",
    pro_monthly: "price_pro_monthly",
    pro_yearly: "price_pro_yearly",
  },
};

describe("setupProducts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates two products and four prices on the first run", async () => {
    const stripe = new MockStripeClient();
    const outputFilePath = await getTempOutputFilePath("first-run");

    const payload = await setupProducts(stripe, {
      mode: "test",
      outputFilePath,
    });

    expect(stripe.productCreates).toHaveLength(2);
    expect(stripe.priceCreates).toHaveLength(4);
    expect(stripe.priceCreates.map((price) => price.lookup_key)).toEqual([
      "solo_monthly",
      "solo_yearly",
      "pro_monthly",
      "pro_yearly",
    ]);
    expect(stripe.priceCreates.map((price) => price.tax_behavior)).toEqual([
      "exclusive",
      "exclusive",
      "exclusive",
      "exclusive",
    ]);
    expect(
      stripe.priceCreates.every((price) => price.recurring?.interval),
    ).toBe(true);
    expect(payload).toEqual(expectedFirstRunPayload);

    await expect(readJsonFile(outputFilePath)).resolves.toEqual(
      expectedFirstRunPayload,
    );
  });

  it("reuses existing products and prices without creating duplicates", async () => {
    const prices = createExistingPrices(
      existingProducts.solo.id,
      existingProducts.pro.id,
    );
    const stripe = new MockStripeClient({
      products: [existingProducts.solo, existingProducts.pro],
      prices,
    });
    const outputFilePath = await getTempOutputFilePath("second-run");

    const firstPayload = await setupProducts(stripe, {
      mode: "test",
      outputFilePath,
    });
    const secondPayload = await setupProducts(stripe, {
      mode: "test",
      outputFilePath,
    });

    expect(stripe.productCreates).toHaveLength(0);
    expect(stripe.priceCreates).toHaveLength(0);
    expect(secondPayload).toEqual(firstPayload);
    expect(secondPayload).toEqual({
      mode: "test",
      products: {
        solo: "prod_solo_existing",
        pro: "prod_pro_existing",
      },
      prices: {
        solo_monthly: "price_solo_monthly_existing",
        solo_yearly: "price_solo_yearly_existing",
        pro_monthly: "price_pro_monthly_existing",
        pro_yearly: "price_pro_yearly_existing",
      },
    });
  });

  it("throws when an existing lookup_key points to a mismatched price amount", async () => {
    const prices = createExistingPrices(
      existingProducts.solo.id,
      existingProducts.pro.id,
    ).map((price) =>
      price.lookup_key === "solo_monthly"
        ? { ...price, unit_amount: 2900 }
        : price,
    );
    const stripe = new MockStripeClient({
      products: [existingProducts.solo, existingProducts.pro],
      prices,
    });

    await expect(
      setupProducts(stripe, {
        mode: "test",
        writeOutputFile: false,
      }),
    ).rejects.toThrow(
      "Existing Stripe price price_solo_monthly_existing for lookup_key solo_monthly has unit_amount 2900; expected 3900.",
    );
  });

  it("returns exit code 1 when STRIPE_API_KEY is missing", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const stripeFactory = vi.fn<() => StripeSetupClient>();

    const result = await runCli({
      env: {},
      stdout,
      stderr,
      stripeFactory,
      writeOutputFile: false,
    });

    expect(result.exitCode).toBe(1);
    expect(stderr).toHaveBeenCalledWith(
      "Missing STRIPE_API_KEY. Inject it from 1Password with op run before running this script.",
    );
    expect(stdout).not.toHaveBeenCalled();
    expect(stripeFactory).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation for live mode", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const stripeFactory = vi.fn<() => StripeSetupClient>();

    const result = await runCli({
      env: { STRIPE_API_KEY: "sk_live_testvalue" },
      stdout,
      stderr,
      stripeFactory,
      writeOutputFile: false,
    });

    expect(result.exitCode).toBe(1);
    expect(stderr).toHaveBeenCalledWith("Mode: live");
    expect(stderr).toHaveBeenCalledWith(
      "Live Stripe key detected. Re-run with --confirm-live to mutate the live account.",
    );
    expect(stdout).not.toHaveBeenCalled();
    expect(stripeFactory).not.toHaveBeenCalled();
  });
});

function createExistingPrices(
  soloProductId: string,
  proProductId: string,
): PriceRecord[] {
  return [
    {
      id: "price_solo_monthly_existing",
      lookup_key: "solo_monthly",
      unit_amount: 3900,
      currency: "usd",
      product: soloProductId,
      recurring: { interval: "month" },
      tax_behavior: "exclusive",
    },
    {
      id: "price_solo_yearly_existing",
      lookup_key: "solo_yearly",
      unit_amount: 37400,
      currency: "usd",
      product: soloProductId,
      recurring: { interval: "year" },
      tax_behavior: "exclusive",
    },
    {
      id: "price_pro_monthly_existing",
      lookup_key: "pro_monthly",
      unit_amount: 9900,
      currency: "usd",
      product: proProductId,
      recurring: { interval: "month" },
      tax_behavior: "exclusive",
    },
    {
      id: "price_pro_yearly_existing",
      lookup_key: "pro_yearly",
      unit_amount: 95000,
      currency: "usd",
      product: proProductId,
      recurring: { interval: "year" },
      tax_behavior: "exclusive",
    },
  ];
}

async function getTempOutputFilePath(label: string): Promise<string> {
  const directory = await mkdtemp(
    path.join(tmpdir(), `stripe-products-${label}-`),
  );

  return path.join(directory, ".stripe-price-ids.test.json");
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}
