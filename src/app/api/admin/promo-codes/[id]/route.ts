import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import {
  getPromoCode,
  updatePromoCode,
  deactivatePromoCode,
  getPromoCodeUsages,
} from "@/lib/admin/promo-code-service";

/**
 * GET /api/admin/promo-codes/[id]
 * 取得單一優惠碼詳情（含使用記錄）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 },
      );
    }

    // 驗證管理員權限
    if (!isAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "無管理員權限" },
        { status: 403 },
      );
    }

    // 取得優惠碼
    const promoCode = await getPromoCode(id);

    if (!promoCode) {
      return NextResponse.json(
        { success: false, error: "找不到優惠碼" },
        { status: 404 },
      );
    }

    // 取得使用記錄
    const usages = await getPromoCodeUsages(id);

    return NextResponse.json({
      success: true,
      data: {
        id: promoCode.id,
        code: promoCode.code,
        name: promoCode.name,
        description: promoCode.description,
        bonusArticles: promoCode.bonus_articles,
        maxUses: promoCode.max_uses,
        currentUses: promoCode.current_uses,
        startsAt: promoCode.starts_at,
        expiresAt: promoCode.expires_at,
        isActive: promoCode.is_active,
        createdAt: promoCode.created_at,
        updatedAt: promoCode.updated_at,
        usages: usages.map((u) => ({
          id: u.id,
          companyId: u.company_id,
          paymentOrderId: u.payment_order_id,
          bonusArticles: u.bonus_articles,
          usedAt: u.used_at,
        })),
      },
    });
  } catch (error) {
    console.error("[API] /admin/promo-codes/[id] GET error:", error);
    return NextResponse.json(
      { success: false, error: "取得優惠碼失敗" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/promo-codes/[id]
 * 更新優惠碼
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 },
      );
    }

    // 驗證管理員權限
    if (!isAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "無管理員權限" },
        { status: 403 },
      );
    }

    // 解析請求內容
    const body = await request.json();
    const { name, description, bonusArticles, maxUses, expiresAt, isActive } =
      body;

    // 更新優惠碼
    const updated = await updatePromoCode({
      id,
      updates: {
        name,
        description,
        bonusArticles,
        maxUses,
        expiresAt,
        isActive,
      },
      adminUserId: user.id,
      adminEmail: user.email || "",
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        bonusArticles: updated.bonus_articles,
        maxUses: updated.max_uses,
        isActive: updated.is_active,
      },
      message: "優惠碼更新成功",
    });
  } catch (error) {
    console.error("[API] /admin/promo-codes/[id] PATCH error:", error);
    const message = error instanceof Error ? error.message : "更新優惠碼失敗";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/promo-codes/[id]
 * 停用優惠碼（軟刪除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 },
      );
    }

    // 驗證管理員權限
    if (!isAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "無管理員權限" },
        { status: 403 },
      );
    }

    // 停用優惠碼
    await deactivatePromoCode({
      id,
      adminUserId: user.id,
      adminEmail: user.email || "",
    });

    return NextResponse.json({
      success: true,
      message: "優惠碼已停用",
    });
  } catch (error) {
    console.error("[API] /admin/promo-codes/[id] DELETE error:", error);
    const message = error instanceof Error ? error.message : "停用優惠碼失敗";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
