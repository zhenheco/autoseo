import { z } from "zod";

const ShoplineIdSchema = z.union([z.string(), z.number()]).transform(String);
const NullableStringDefault = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? "");

export const ShoplineImageSchema = z.object({
  id: ShoplineIdSchema,
  src: z.string().min(1),
  alt: z.string().nullable().optional(),
  position: z.number().optional(),
});

export const ShoplineSeoSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

export const ShoplineProductSchema = z
  .object({
    id: ShoplineIdSchema,
    title: z.string(),
    handle: z.string(),
    product_type: NullableStringDefault,
    vendor: NullableStringDefault,
    status: z
      .enum(["active", "archived", "draft"])
      .optional()
      .default("active"),
    tags: NullableStringDefault,
    images: z.array(ShoplineImageSchema).optional().default([]),
    variants: z.array(z.unknown()).optional().default([]),
    created_at: z.string(),
    updated_at: z.string(),
    seo: ShoplineSeoSchema.optional(),
  })
  .passthrough();

export const ShoplineShopSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    domain: z.string(),
    myshopline_domain: z.string(),
    country: z.string().optional(),
    currency: z.string().optional(),
    timezone: z.string().optional(),
  })
  .passthrough();

export type ShoplineImage = z.infer<typeof ShoplineImageSchema>;
export type ShoplineSeo = z.infer<typeof ShoplineSeoSchema>;
export type ShoplineProduct = z.infer<typeof ShoplineProductSchema>;
export type ShoplineShop = z.infer<typeof ShoplineShopSchema>;

export class ShoplineRateLimitError extends Error {
  constructor(public retryAfter?: number) {
    super("shopline_rate_limited");
    this.name = "ShoplineRateLimitError";
  }
}

export class ShoplineAuthError extends Error {
  constructor(message = "shopline_auth_invalid") {
    super(message);
    this.name = "ShoplineAuthError";
  }
}
