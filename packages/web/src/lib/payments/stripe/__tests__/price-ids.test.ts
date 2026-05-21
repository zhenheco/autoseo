import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadPriceIdMap } from "../price-ids";

describe("Stripe price id loader", () => {
  it("loads price ids from the mode-specific file", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "stripe-prices-"));
    try {
      writeFileSync(
        path.join(cwd, ".stripe-price-ids.test.json"),
        JSON.stringify({
          mode: "test",
          prices: {
            solo_monthly: "price_file_solo_monthly",
            solo_yearly: "price_file_solo_yearly",
            pro_monthly: "price_file_pro_monthly",
            pro_yearly: "price_file_pro_yearly",
          },
        }),
        "utf8",
      );

      expect(
        loadPriceIdMap({
          cwd,
          env: { NODE_ENV: "test" },
          mode: "test",
        }),
      ).toEqual({
        solo_monthly: "price_file_solo_monthly",
        solo_yearly: "price_file_solo_yearly",
        pro_monthly: "price_file_pro_monthly",
        pro_yearly: "price_file_pro_yearly",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("falls back to environment variables when the file is missing", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "stripe-prices-"));
    try {
      expect(
        loadPriceIdMap({
          cwd,
          mode: "test",
          env: {
            NODE_ENV: "test",
            STRIPE_PRICE_SOLO_MONTHLY: "price_env_solo_monthly",
            STRIPE_PRICE_SOLO_YEARLY: "price_env_solo_yearly",
            STRIPE_PRICE_PRO_MONTHLY: "price_env_pro_monthly",
            STRIPE_PRICE_PRO_YEARLY: "price_env_pro_yearly",
          },
        }),
      ).toEqual({
        solo_monthly: "price_env_solo_monthly",
        solo_yearly: "price_env_solo_yearly",
        pro_monthly: "price_env_pro_monthly",
        pro_yearly: "price_env_pro_yearly",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
