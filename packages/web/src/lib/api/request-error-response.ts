import { NextResponse } from "next/server";
import type { SafeJsonError } from "./request-body";
import type { RequestSchemaValidationError } from "./request-schema";

type JsonRequestError = SafeJsonError | RequestSchemaValidationError;

export interface RequestErrorResponseOptions {
  fieldOrder?: string[];
}

export function requestErrorResponse(
  error: JsonRequestError,
  options: RequestErrorResponseOptions = {},
) {
  if (error.code === "INVALID_JSON") {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: firstValidationMessage(error.details, options.fieldOrder),
    },
    { status: 400 },
  );
}

function firstValidationMessage(
  details: RequestSchemaValidationError["details"],
  fieldOrder: string[] = [],
) {
  const fieldErrors = details.fieldErrors as Record<
    string,
    string[] | undefined
  >;

  for (const field of fieldOrder) {
    const message = fieldErrors[field]?.[0];
    if (message) {
      return message;
    }
  }

  return (
    details.formErrors[0] ||
    Object.values(fieldErrors).flatMap((messages) => messages || [])[0] ||
    "Request body validation failed"
  );
}
