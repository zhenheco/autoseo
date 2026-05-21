import { z } from "zod";
import type { Json } from "@/types/database.types";

const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export const brandMemoryHexColorSchema = z
  .string()
  .trim()
  .regex(hexColorPattern, "Use a 6-digit hex color, for example #2563eb");

export const brandMemoryLogoUrlSchema = z
  .string()
  .trim()
  .url("Use a valid logo URL");

const nullableTextSchema = z.union([z.string().trim().min(1), z.null()]);

const jsonValueSchema = z.custom<Json>((value): value is Json =>
  isJsonValue(value),
);

export const brandMemoryFieldsSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    voiceTone: nullableTextSchema.optional(),
    targetAudience: jsonValueSchema.nullable().optional(),
    valueProps: z.array(z.string().trim().min(1)).nullable().optional(),
    brandGuidelines: nullableTextSchema.optional(),
    logoUrl: z.union([brandMemoryLogoUrlSchema, z.null()]).optional(),
    primaryColor: z.union([brandMemoryHexColorSchema, z.null()]).optional(),
    secondaryColor: z.union([brandMemoryHexColorSchema, z.null()]).optional(),
  })
  .strict();

export const brandMemoryPatchSchema = brandMemoryFieldsSchema.refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one field is required",
  },
);

export type BrandMemoryFields = z.output<typeof brandMemoryFieldsSchema>;

function isJsonValue(value: unknown): value is Json {
  if (value === null) return true;

  const valueType = typeof value;
  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (valueType === "object") {
    return Object.values(value as Record<string, unknown>).every(
      (entry) => entry === undefined || isJsonValue(entry),
    );
  }

  return false;
}
