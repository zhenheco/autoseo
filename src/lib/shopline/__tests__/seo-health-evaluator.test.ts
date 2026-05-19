import { describe, expect, it } from "vitest";
import {
  evaluateBatchSeoHealth,
  evaluateSeoHealth,
} from "../seo-health-evaluator";

describe("evaluateSeoHealth", () => {
  it("flags missing and overlong SEO fields plus missing product image alt", () => {
    expect(
      evaluateSeoHealth({
        entityType: "product",
        entity: {
          title: "Product",
          seo: {
            title: "",
            description: "d".repeat(161),
          },
          images: [
            { id: "image-1", alt: "Hero image" },
            { id: "image-2", alt: "" },
          ],
        },
      }),
    ).toEqual(["missing_seo_title", "seo_description_too_long", "missing_alt"]);

    expect(
      evaluateSeoHealth({
        entityType: "product",
        entity: {
          title: "Product",
          seo: {
            title: "t".repeat(71),
            description: "",
          },
          images: [{ id: "image-1", alt: null }],
        },
      }),
    ).toEqual(["seo_title_too_long", "missing_seo_description", "missing_alt"]);
  });

  it("does not flag healthy SEO fields or image alts", () => {
    expect(
      evaluateSeoHealth({
        entityType: "product",
        entity: {
          title: "Product",
          seo: {
            title: "SEO title",
            description: "SEO description",
          },
          images: [{ id: "image-1", alt: "Hero image" }],
        },
      }),
    ).toEqual([]);
  });

  it("does not evaluate missing_alt for collections", () => {
    expect(
      evaluateSeoHealth({
        entityType: "collection",
        entity: {
          title: "Collection",
          seo: {
            title: "SEO title",
            description: "SEO description",
          },
          images: [{ id: "image-1", alt: "" }],
        },
      }),
    ).toEqual([]);
  });
});

describe("evaluateBatchSeoHealth", () => {
  it("adds duplicate_title for every item sharing the same entity title", () => {
    const result = evaluateBatchSeoHealth([
      {
        id: "product-1",
        entityType: "product",
        entity: {
          title: "Same title",
          seo: { title: "SEO 1", description: "Description 1" },
        },
      },
      {
        id: "product-2",
        entityType: "product",
        entity: {
          title: "Unique title",
          seo: { title: "SEO 2", description: "Description 2" },
        },
      },
      {
        id: "product-3",
        entityType: "product",
        entity: {
          title: "Same title",
          seo: { title: "SEO 3", description: "Description 3" },
        },
      },
    ]);

    expect(result.get("product-1")).toContain("duplicate_title");
    expect(result.get("product-2")).not.toContain("duplicate_title");
    expect(result.get("product-3")).toContain("duplicate_title");
  });
});
