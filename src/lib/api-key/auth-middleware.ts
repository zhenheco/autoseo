/**
 * API 認證 Middleware
 *
 * 用於 /api/v1/sites/* 端點的 API Key 認證
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, WebsiteInfo } from "./api-key-service";

/**
 * API 端點處理函數類型
 */
export type ApiHandler = (
  request: NextRequest,
  website: WebsiteInfo,
) => Promise<Response>;

/**
 * 從 Authorization header 提取 Bearer token
 *
 * @param authHeader - Authorization header 值
 * @returns token 或 null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const trimmed = authHeader.trim();

  // 必須以 "Bearer " 開頭
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  // 提取 token 部分
  const token = trimmed.slice(7).trim();

  if (!token) {
    return null;
  }

  return token;
}

/**
 * 建立標準化的錯誤回應
 *
 * @param message - 錯誤訊息
 * @param status - HTTP 狀態碼
 * @returns NextResponse
 */
export function createErrorResponse(
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

/**
 * 建立標準化的成功回應
 *
 * @param data - 回應資料
 * @param status - HTTP 狀態碼
 * @returns NextResponse
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

/**
 * API Key 認證 Higher-Order Function
 *
 * 包裝 API handler，自動處理認證邏輯
 *
 * @param handler - 原始 API handler
 * @returns 包裝後的 handler
 *
 * @example
 * ```ts
 * export const GET = withApiKeyAuth(async (request, website) => {
 *   // website 已經過驗證，可以直接使用
 *   const articles = await getArticles(website.id)
 *   return NextResponse.json({ articles })
 * })
 * ```
 */
export function withApiKeyAuth(handler: ApiHandler) {
  return async (request: NextRequest): Promise<Response> => {
    // 1. 取得 Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return createErrorResponse("Missing authorization header", 401);
    }

    // 2. 提取 Bearer token
    const token = extractBearerToken(authHeader);

    if (!token) {
      return createErrorResponse("Invalid authorization format", 401);
    }

    // 3. 驗證 API Key
    const website = await validateApiKey(token);

    if (!website) {
      return createErrorResponse("Invalid API key", 401);
    }

    // 4. 呼叫原始 handler，傳入 website 資訊
    return handler(request, website);
  };
}

/**
 * 從 request 取得分頁參數
 *
 * @param request - NextRequest
 * @returns 分頁參數
 */
export function getPaginationParams(request: NextRequest): {
  page: number;
  limit: number;
} {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10)),
  );

  return { page, limit };
}

/**
 * 從 request 取得語系參數
 *
 * @param request - NextRequest
 * @returns 語系代碼或 null
 */
export function getLanguageParam(request: NextRequest): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("lang");
}
