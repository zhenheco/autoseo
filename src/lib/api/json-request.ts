import type { z } from "zod";
import { safeJson, type SafeJsonResult } from "./request-body";
import { parseRequestSchema, type RequestSchemaResult } from "./request-schema";

export type JsonRequestParseResult<T> =
  | Extract<SafeJsonResult<T>, { success: false }>
  | RequestSchemaResult<T>;

export async function parseJsonRequest<TSchema extends z.ZodTypeAny>(
  request: Pick<Request, "json">,
  schema: TSchema,
): Promise<JsonRequestParseResult<z.output<TSchema>>> {
  const jsonResult = await safeJson<unknown>(request);
  if (!jsonResult.success) {
    return jsonResult;
  }

  return parseRequestSchema(schema, jsonResult.data);
}
