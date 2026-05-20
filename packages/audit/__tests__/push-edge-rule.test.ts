import { describe, expect, it, vi } from "vitest";
import { mergeEdgeRule, pushEdgeRule } from "../src/push-edge-rule";

describe("pushEdgeRule", () => {
  it("writes edge rules to KV", async () => {
    const kvPut = vi.fn(async () => undefined);
    const result = await pushEdgeRule(
      {
        shopDomain: "brand.com.tw",
        path: "/products/foo",
        rules: [
          {
            type: "meta-description",
            value: "Edge-rendered product description.",
          },
        ],
      },
      {
        kvGet: vi.fn(async () => null),
        kvPut,
        now: () => new Date("2026-05-21T00:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      key: "brand.com.tw:/products/foo",
      ruleCount: 1,
    });
    expect(kvPut).toHaveBeenCalledWith(
      "brand.com.tw:/products/foo",
      JSON.stringify({
        rules: [
          {
            type: "meta-description",
            value: "Edge-rendered product description.",
          },
        ],
        updated_at: "2026-05-21T00:00:00.000Z",
      }),
    );
  });

  it("merges existing rules by overwriting matching types and appending new types", async () => {
    const result = await mergeEdgeRule(
      {
        shopDomain: "brand.com.tw",
        path: "/products/foo",
        rules: [
          {
            type: "meta-description",
            value: "Updated description.",
          },
          {
            type: "canonical",
            value: "https://brand.com.tw/products/foo",
          },
        ],
      },
      {
        kvGet: vi.fn(async () =>
          JSON.stringify({
            rules: [
              {
                type: "meta-description",
                value: "Old description.",
              },
              {
                type: "og-image",
                value: "https://cdn.brand.com.tw/old.png",
              },
            ],
            updated_at: "2026-05-20T00:00:00.000Z",
          }),
        ),
      },
    );

    expect(result).toEqual({
      key: "brand.com.tw:/products/foo",
      ruleCount: 3,
      rules: [
        {
          type: "meta-description",
          value: "Updated description.",
        },
        {
          type: "og-image",
          value: "https://cdn.brand.com.tw/old.png",
        },
        {
          type: "canonical",
          value: "https://brand.com.tw/products/foo",
        },
      ],
    });
  });
});
