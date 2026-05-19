import { describe, expect, it } from "vitest";
import { safeJson } from "./request-body";

describe("safeJson", () => {
  it("parses valid JSON request bodies", async () => {
    const request = new Request("https://example.com/api", {
      method: "POST",
      body: JSON.stringify({ keyword: "SEO 顧問" }),
    });

    const result = await safeJson(request);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.data).toEqual({ keyword: "SEO 顧問" });
  });

  it("returns validation error for missing request bodies", async () => {
    const request = new Request("https://example.com/api", {
      method: "POST",
    });

    const result = await safeJson(request);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected missing body error");
    }
    expect(result.error).toEqual({
      code: "INVALID_JSON",
      message: "Request body must be valid JSON",
    });
  });

  it("returns validation error for malformed JSON request bodies", async () => {
    const request = new Request("https://example.com/api", {
      method: "POST",
      body: "{",
    });

    const result = await safeJson(request);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected malformed body error");
    }
    expect(result.error).toEqual({
      code: "INVALID_JSON",
      message: "Request body must be valid JSON",
    });
  });
});
