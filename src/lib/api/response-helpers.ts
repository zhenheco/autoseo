/**
 * 統一 API 回應工具
 * 標準化所有 API 路由的回應格式
 */

import { NextResponse } from "next/server";

// HTTP 狀態碼常數
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// 錯誤代碼（可用於前端國際化）
export const ERROR_CODES = {
  // 認證相關
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",

  // 權限相關
  FORBIDDEN: "FORBIDDEN",
  NO_COMPANY_MEMBERSHIP: "NO_COMPANY_MEMBERSHIP",
  NOT_ADMIN: "NOT_ADMIN",

  // 訂閱相關
  NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // 資源相關
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // 驗證相關
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // 系統相關
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// API 回應介面
interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

interface ApiErrorResponse {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: unknown;
}

type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 成功回應
 */
export function successResponse<T>(
  data?: T,
  message?: string,
  status: number = HTTP_STATUS.OK,
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = {
    success: true,
  };

  if (data !== undefined) {
    body.data = data;
  }

  if (message) {
    body.message = message;
  }

  return NextResponse.json(body, { status });
}

/**
 * 錯誤回應
 */
export function errorResponse(
  error: string,
  status: number = HTTP_STATUS.BAD_REQUEST,
  code?: ErrorCode,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    error,
  };

  if (code) {
    body.code = code;
  }

  if (details !== undefined) {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

// 常用錯誤回應快捷函數

/**
 * 401 未授權
 */
export function unauthorized(
  message: string = "Unauthorized",
): NextResponse<ApiErrorResponse> {
  return errorResponse(
    message,
    HTTP_STATUS.UNAUTHORIZED,
    ERROR_CODES.UNAUTHORIZED,
  );
}

/**
 * 403 禁止訪問
 */
export function forbidden(
  message: string = "Forbidden",
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
}

/**
 * 403 無公司成員資格
 */
export function noCompanyMembership(): NextResponse<ApiErrorResponse> {
  return errorResponse(
    "No active company membership",
    HTTP_STATUS.FORBIDDEN,
    ERROR_CODES.NO_COMPANY_MEMBERSHIP,
  );
}

/**
 * 402 無訂閱
 */
export function noSubscription(): NextResponse<ApiErrorResponse> {
  return errorResponse(
    "No active subscription",
    HTTP_STATUS.PAYMENT_REQUIRED,
    ERROR_CODES.NO_SUBSCRIPTION,
  );
}

/**
 * 402 額度超限
 */
export function quotaExceeded(
  message: string = "Quota exceeded",
): NextResponse<ApiErrorResponse> {
  return errorResponse(
    message,
    HTTP_STATUS.PAYMENT_REQUIRED,
    ERROR_CODES.QUOTA_EXCEEDED,
  );
}

/**
 * 404 找不到資源
 */
export function notFound(
  resource: string = "Resource",
): NextResponse<ApiErrorResponse> {
  return errorResponse(
    `${resource} not found`,
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.NOT_FOUND,
  );
}

/**
 * 400 驗證錯誤
 */
export function validationError(
  message: string,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  return errorResponse(
    message,
    HTTP_STATUS.BAD_REQUEST,
    ERROR_CODES.VALIDATION_ERROR,
    details,
  );
}

/**
 * 429 請求過多
 */
export function rateLimited(
  retryAfter?: number,
): NextResponse<ApiErrorResponse> {
  const response = errorResponse(
    "Too many requests",
    HTTP_STATUS.TOO_MANY_REQUESTS,
    ERROR_CODES.RATE_LIMITED,
  );

  if (retryAfter) {
    response.headers.set("Retry-After", String(retryAfter));
  }

  return response;
}

/**
 * 500 內部錯誤
 */
export function internalError(
  message: string = "Internal server error",
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  // 在生產環境不返回詳細錯誤
  const safeDetails =
    process.env.NODE_ENV === "development" ? details : undefined;
  return errorResponse(
    message,
    HTTP_STATUS.INTERNAL_ERROR,
    ERROR_CODES.INTERNAL_ERROR,
    safeDetails,
  );
}

/**
 * 安全地處理錯誤並返回適當回應
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error("API Error:", error);

  if (error instanceof Error) {
    return internalError(
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
      process.env.NODE_ENV === "development" ? error.stack : undefined,
    );
  }

  return internalError();
}
