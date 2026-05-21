import { describe, expect, it } from "vitest";
import { requestErrorResponse } from "./request-error-response";
import type { RequestSchemaValidationError } from "./request-schema";

describe("requestErrorResponse", () => {
  it("keeps the legacy invalid JSON response shape", async () => {
    const response = requestErrorResponse({
      code: "INVALID_JSON",
      message: "Request body must be valid JSON",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("returns the first form validation error without a code field", async () => {
    const response = requestErrorResponse(
      validationError({
        formErrors: ["Title or industry is required"],
        fieldErrors: {},
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Title or industry is required",
    });
  });

  it("uses field order when selecting validation messages", async () => {
    const response = requestErrorResponse(
      validationError({
        formErrors: [],
        fieldErrors: {
          language: ["Language is required"],
          region: ["Region is required"],
        },
      }),
      {
        fieldOrder: ["region", "language"],
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Region is required",
    });
  });
});

function validationError(
  details: RequestSchemaValidationError["details"],
): RequestSchemaValidationError {
  return {
    code: "VALIDATION_ERROR",
    message: "Request body validation failed",
    details,
  };
}
