import { describe, test, expect } from "vitest";
import {
  successResponse,
  errorResponse,
  unauthorized,
  forbidden,
  noCompanyMembership,
  noSubscription,
  quotaExceeded,
  notFound,
  validationError,
  rateLimited,
  internalError,
  HTTP_STATUS,
  ERROR_CODES,
} from "./response-helpers";

describe("response-helpers", () => {
  describe("successResponse", () => {
    test("返回基本成功回應", async () => {
      const response = successResponse();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    test("返回帶資料的成功回應", async () => {
      const data = { id: 1, name: "Test" };
      const response = successResponse(data);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toEqual(data);
    });

    test("返回帶訊息的成功回應", async () => {
      const response = successResponse(null, "操作成功");
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.message).toBe("操作成功");
    });

    test("可自訂狀態碼", async () => {
      const response = successResponse({}, undefined, HTTP_STATUS.CREATED);
      expect(response.status).toBe(201);
    });
  });

  describe("errorResponse", () => {
    test("返回基本錯誤回應", async () => {
      const response = errorResponse("Something went wrong");
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Something went wrong");
    });

    test("返回帶錯誤代碼的回應", async () => {
      const response = errorResponse(
        "Invalid input",
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
      const json = await response.json();

      expect(json.code).toBe("VALIDATION_ERROR");
    });

    test("返回帶詳細資訊的回應", async () => {
      const details = { field: "email", message: "Invalid format" };
      const response = errorResponse(
        "Validation failed",
        400,
        undefined,
        details,
      );
      const json = await response.json();

      expect(json.details).toEqual(details);
    });
  });

  describe("快捷錯誤函數", () => {
    test("unauthorized 返回 401", async () => {
      const response = unauthorized();
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.code).toBe("UNAUTHORIZED");
    });

    test("forbidden 返回 403", async () => {
      const response = forbidden();
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("FORBIDDEN");
    });

    test("noCompanyMembership 返回 403 和正確代碼", async () => {
      const response = noCompanyMembership();
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("NO_COMPANY_MEMBERSHIP");
    });

    test("noSubscription 返回 402", async () => {
      const response = noSubscription();
      const json = await response.json();

      expect(response.status).toBe(402);
      expect(json.code).toBe("NO_SUBSCRIPTION");
    });

    test("quotaExceeded 返回 402", async () => {
      const response = quotaExceeded("Token limit reached");
      const json = await response.json();

      expect(response.status).toBe(402);
      expect(json.error).toBe("Token limit reached");
      expect(json.code).toBe("QUOTA_EXCEEDED");
    });

    test("notFound 返回 404", async () => {
      const response = notFound("Article");
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("Article not found");
      expect(json.code).toBe("NOT_FOUND");
    });

    test("validationError 返回 400", async () => {
      const details = { fields: ["email", "password"] };
      const response = validationError("Invalid input", details);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.details).toEqual(details);
    });

    test("rateLimited 返回 429", async () => {
      const response = rateLimited(60);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
    });

    test("internalError 返回 500", async () => {
      const response = internalError();
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("HTTP_STATUS 常數", () => {
    test("包含所有必要的狀態碼", () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
    });
  });

  describe("ERROR_CODES 常數", () => {
    test("包含所有必要的錯誤代碼", () => {
      expect(ERROR_CODES.UNAUTHORIZED).toBe("UNAUTHORIZED");
      expect(ERROR_CODES.FORBIDDEN).toBe("FORBIDDEN");
      expect(ERROR_CODES.NO_SUBSCRIPTION).toBe("NO_SUBSCRIPTION");
      expect(ERROR_CODES.QUOTA_EXCEEDED).toBe("QUOTA_EXCEEDED");
      expect(ERROR_CODES.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    });
  });
});
