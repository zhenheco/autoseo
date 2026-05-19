export type SafeJsonResult<T = unknown> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: "INVALID_JSON";
        message: string;
      };
    };

export type SafeJsonError = Extract<
  SafeJsonResult,
  { success: false }
>["error"];

export async function safeJson<T = unknown>(
  request: Pick<Request, "json">,
): Promise<SafeJsonResult<T>> {
  try {
    const data = (await request.json()) as T;
    return {
      success: true,
      data,
    };
  } catch {
    return {
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON",
      },
    };
  }
}
