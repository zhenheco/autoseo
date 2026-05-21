import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonRequest } from "./json-request";

describe("parseJsonRequest", () => {
  const schema = z.object({
    keyword: z
      .string()
      .min(1)
      .transform((value) => value.trim()),
    count: z.number().int().positive(),
  });

  it("returns parsed and transformed data for valid JSON matching schema", async () => {
    const result = await parseJsonRequest(
      {
        json: () =>
          Promise.resolve({
            keyword: "  SEO  ",
            count: 2,
          }),
      },
      schema,
    );

    expect(result).toEqual({
      success: true,
      data: {
        keyword: "SEO",
        count: 2,
      },
    });
  });

  it("returns INVALID_JSON when request body cannot be parsed", async () => {
    const result = await parseJsonRequest(
      {
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      },
      schema,
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON",
      },
    });
  });

  it("returns VALIDATION_ERROR when JSON does not match schema", async () => {
    const result = await parseJsonRequest(
      {
        json: () =>
          Promise.resolve({
            keyword: "",
            count: "2",
          }),
      },
      schema,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      if (result.error.code === "VALIDATION_ERROR") {
        expect(result.error.details.fieldErrors).toEqual({
          keyword: ["Too small: expected string to have >=1 characters"],
          count: ["Invalid input: expected number, received string"],
        });
      }
    }
  });
});
