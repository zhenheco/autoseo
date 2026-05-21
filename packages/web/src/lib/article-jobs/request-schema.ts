import { z } from "zod";

function isTruthyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export const singleArticleGenerationRequestSchema = z
  .object({
    keyword: z.unknown().optional(),
    title: z.unknown().optional(),
    industry: z.unknown().optional(),
    region: z.unknown().optional(),
    language: z.unknown().optional(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    const hasStrategyField = Boolean(
      body.industry || body.region || body.language,
    );

    if (hasStrategyField) {
      if (!isTruthyString(body.industry)) {
        ctx.addIssue({
          code: "custom",
          path: ["industry"],
          message: "Industry is required",
        });
      }
      if (!isTruthyString(body.region)) {
        ctx.addIssue({
          code: "custom",
          path: ["region"],
          message: "Region is required",
        });
      }
      if (!isTruthyString(body.language)) {
        ctx.addIssue({
          code: "custom",
          path: ["language"],
          message: "Language is required",
        });
      }
      return;
    }

    if (!isTruthyString(body.title) && !isTruthyString(body.keyword)) {
      ctx.addIssue({
        code: "custom",
        message: "Title or industry is required",
      });
    }
  });

export const batchArticleGenerationRequestSchema = z
  .object({
    items: z.unknown().optional(),
    keywords: z.unknown().optional(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    const generationItems = getBatchGenerationItems(body);

    if (generationItems.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Items or keywords array is required",
      });
      return;
    }

    for (const item of generationItems) {
      if (!item.keyword || typeof item.keyword !== "string") {
        ctx.addIssue({
          code: "custom",
          path: [item.source],
          message: "每個項目都必須包含 keyword 或 title",
        });
        return;
      }

      if (item.keyword.length > 500) {
        ctx.addIssue({
          code: "custom",
          path: [item.source],
          message: "關鍵字長度不能超過 500 字元",
        });
        return;
      }
    }
  });

function getBatchGenerationItems(body: {
  items?: unknown;
  keywords?: unknown;
}): Array<{ source: "items" | "keywords"; keyword: unknown }> {
  if (Array.isArray(body.items)) {
    return body.items.map((item) => {
      if (!isRecord(item)) {
        return {
          source: "items",
          keyword: undefined,
        };
      }

      return {
        source: "items",
        keyword: item.keyword || item.title,
      };
    });
  }

  if (Array.isArray(body.keywords)) {
    return body.keywords.map((keyword) => ({
      source: "keywords",
      keyword,
    }));
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
