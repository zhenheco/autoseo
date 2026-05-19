import type { z } from "zod";

export interface RequestSchemaValidationError {
  code: "VALIDATION_ERROR";
  message: string;
  details: z.inferFlattenedErrors<z.ZodTypeAny>;
}

export type RequestSchemaResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: RequestSchemaValidationError;
    };

export function parseRequestSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): RequestSchemaResult<z.output<TSchema>> {
  const result = schema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Request body validation failed",
      details: result.error.flatten(),
    },
  };
}
