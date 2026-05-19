import { NextRequest, NextResponse } from "next/server";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  getAllPromoCodes,
  createPromoCode,
} from "@/lib/admin/promo-code-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/promo-codes
 * 取得所有優惠碼
 */
export const GET = withRouteAuth("admin", async () => {
  try {
    // 取得所有優惠碼
    const promoCodes = await getAllPromoCodes();

    // 格式化資料
    const formattedData = promoCodes.map((code) => ({
      id: code.id,
      code: code.code,
      name: code.name,
      description: code.description,
      bonusArticles: code.bonus_articles,
      maxUses: code.max_uses,
      currentUses: code.current_uses,
      startsAt: code.starts_at,
      expiresAt: code.expires_at,
      isActive: code.is_active,
      createdAt: code.created_at,
      updatedAt: code.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      total: formattedData.length,
    });
  } catch (error) {
    console.error("[API] /admin/promo-codes GET error:", error);
    return NextResponse.json(
      { success: false, error: "取得優惠碼列表失敗" },
      { status: 500 },
    );
  }
});

/**
 * POST /api/admin/promo-codes
 * 建立新優惠碼
 */
export const POST = withRouteAuth(
  "admin",
  async (request: NextRequest, { user }) => {
    try {
      // 解析請求內容
      const bodyResult = await safeJson<{
        code?: unknown;
        name?: unknown;
        description?: string;
        bonusArticles?: unknown;
        maxUses?: number;
        startsAt?: string;
        expiresAt?: string;
      }>(request);
      if (!bodyResult.success) {
        return requestErrorResponse(bodyResult.error);
      }

      const body = bodyResult.data;
      const {
        code,
        name,
        description,
        bonusArticles,
        maxUses,
        startsAt,
        expiresAt,
      } = body;

      // 驗證必要欄位
      if (!code || typeof code !== "string") {
        return NextResponse.json(
          { success: false, error: "請提供優惠碼" },
          { status: 400 },
        );
      }

      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { success: false, error: "請提供優惠碼名稱" },
          { status: 400 },
        );
      }

      if (
        !bonusArticles ||
        typeof bonusArticles !== "number" ||
        bonusArticles <= 0
      ) {
        return NextResponse.json(
          { success: false, error: "請提供有效的加送篇數" },
          { status: 400 },
        );
      }

      // 建立優惠碼
      const promoCode = await createPromoCode({
        code,
        name,
        description,
        bonusArticles,
        maxUses: maxUses || undefined,
        startsAt: startsAt || undefined,
        expiresAt: expiresAt || undefined,
        createdBy: user.id,
        adminEmail: user.email || "",
      });

      return NextResponse.json({
        success: true,
        data: {
          id: promoCode.id,
          code: promoCode.code,
          name: promoCode.name,
          bonusArticles: promoCode.bonus_articles,
        },
        message: "優惠碼建立成功",
      });
    } catch (error) {
      console.error("[API] /admin/promo-codes POST error:", error);
      const message = error instanceof Error ? error.message : "建立優惠碼失敗";
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 },
      );
    }
  },
);
