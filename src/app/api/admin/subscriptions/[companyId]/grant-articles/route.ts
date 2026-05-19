import { NextRequest, NextResponse } from "next/server";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import { withRouteAuth } from "@/lib/api/route-auth";
import { grantArticles } from "@/lib/admin/admin-service";

/**
 * POST /api/admin/subscriptions/[companyId]/grant-articles
 * 贈送額外篇數
 */
export const POST = withRouteAuth(
  "admin",
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ companyId: string }> },
  ) => {
    try {
      const { companyId } = await params;

      // 解析請求內容
      const bodyResult = await safeJson<{
        articles?: unknown;
        reason?: string;
      }>(request);
      if (!bodyResult.success) {
        return requestErrorResponse(bodyResult.error);
      }

      const body = bodyResult.data;
      const { articles, reason } = body;

      if (!articles || typeof articles !== "number" || articles <= 0) {
        return NextResponse.json(
          { success: false, error: "請提供有效的篇數" },
          { status: 400 },
        );
      }

      // 執行贈送
      await grantArticles({
        companyId,
        articles,
        adminUserId: user.id,
        adminEmail: user.email || "",
        reason,
      });

      return NextResponse.json({
        success: true,
        message: `已成功贈送 ${articles} 篇`,
      });
    } catch (error) {
      console.error("[API] /admin/subscriptions/grant-articles error:", error);
      const message = error instanceof Error ? error.message : "贈送篇數失敗";
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 },
      );
    }
  },
);
