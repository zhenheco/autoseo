import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseRequestSchema } from "./request-schema";

describe("parseRequestSchema", () => {
  const schema = z.object({
    title: z.string().min(1),
    count: z.number().int().positive(),
  });

  it("returns typed data when input matches schema", () => {
    const result = parseRequestSchema(schema, {
      title: "SEO brief",
      count: 3,
    });

    expect(result).toEqual({
      success: true,
      data: {
        title: "SEO brief",
        count: 3,
      },
    });
  });

  it("returns validation error with field details when input fails schema", () => {
    const result = parseRequestSchema(schema, {
      title: "",
      count: "3",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBe("Request body validation failed");
      expect(result.error.details.fieldErrors).toEqual({
        title: ["Too small: expected string to have >=1 characters"],
        count: ["Invalid input: expected number, received string"],
      });
    }
  });

  it("keeps schema transforms in the success data", () => {
    const transformedSchema = z.object({
      keyword: z.string().transform((value) => value.trim()),
    });

    const result = parseRequestSchema(transformedSchema, {
      keyword: "  local SEO  ",
    });

    expect(result).toEqual({
      success: true,
      data: {
        keyword: "local SEO",
      },
    });
  });
});
