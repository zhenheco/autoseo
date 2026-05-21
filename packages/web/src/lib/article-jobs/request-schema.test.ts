import { describe, expect, it } from "vitest";
import { parseRequestSchema } from "@/lib/api/request-schema";
import {
  batchArticleGenerationRequestSchema,
  singleArticleGenerationRequestSchema,
} from "./request-schema";

describe("singleArticleGenerationRequestSchema", () => {
  it("accepts legacy title requests and preserves passthrough fields", () => {
    const result = parseRequestSchema(singleArticleGenerationRequestSchema, {
      title: "SEO",
      competitors: ["https://example.com"],
      website_id: null,
      writing_style: "expert",
    });

    expect(result).toEqual({
      success: true,
      data: {
        title: "SEO",
        competitors: ["https://example.com"],
        website_id: null,
        writing_style: "expert",
      },
    });
  });

  it("accepts complete strategy requests", () => {
    const result = parseRequestSchema(singleArticleGenerationRequestSchema, {
      industry: "SEO",
      region: "Taiwan",
      language: "zh-TW",
    });

    expect(result.success).toBe(true);
  });

  it("requires title or complete strategy fields", () => {
    const result = parseRequestSchema(singleArticleGenerationRequestSchema, {});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.details.formErrors).toEqual([
        "Title or industry is required",
      ]);
    }
  });

  it("keeps legacy missing strategy field messages", () => {
    const result = parseRequestSchema(singleArticleGenerationRequestSchema, {
      industry: "SEO",
      language: "zh-TW",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.details.fieldErrors).toEqual({
        region: ["Region is required"],
      });
    }
  });
});

describe("batchArticleGenerationRequestSchema", () => {
  it("accepts legacy keyword arrays and preserves options", () => {
    const result = parseRequestSchema(batchArticleGenerationRequestSchema, {
      keywords: ["SEO", "content"],
      options: {
        targetLanguage: "zh-TW",
        wordCount: "1800",
      },
    });

    expect(result).toEqual({
      success: true,
      data: {
        keywords: ["SEO", "content"],
        options: {
          targetLanguage: "zh-TW",
          wordCount: "1800",
        },
      },
    });
  });

  it("accepts item arrays", () => {
    const result = parseRequestSchema(batchArticleGenerationRequestSchema, {
      items: [
        {
          keyword: "SEO",
          title: "SEO guide",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires items or keywords", () => {
    const result = parseRequestSchema(batchArticleGenerationRequestSchema, {});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.details.formErrors).toEqual([
        "Items or keywords array is required",
      ]);
    }
  });

  it("requires every item to include keyword or title", () => {
    const result = parseRequestSchema(batchArticleGenerationRequestSchema, {
      items: [{}],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.details.fieldErrors).toEqual({
        items: ["每個項目都必須包含 keyword 或 title"],
      });
    }
  });

  it("rejects keywords over 500 characters", () => {
    const result = parseRequestSchema(batchArticleGenerationRequestSchema, {
      keywords: ["x".repeat(501)],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.details.fieldErrors).toEqual({
        keywords: ["關鍵字長度不能超過 500 字元"],
      });
    }
  });
});
