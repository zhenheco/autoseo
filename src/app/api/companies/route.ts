/**
 * 公司管理 API
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  internalError,
  HTTP_STATUS,
} from "@/lib/api/response-helpers";

/**
 * 生成公司 slug
 */
function generateSlug(name: string): string {
  const random = Math.random().toString(36).substring(2, 8);
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 20);
  return `${slug}-${random}`;
}

/**
 * POST /api/companies
 * 建立新公司
 */
export const POST = withAuth(
  async (request: NextRequest, { user, supabase }) => {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return validationError("公司名稱為必填");
    }

    // 建立公司
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name,
        slug: generateSlug(name),
        owner_id: user.id,
        subscription_tier: "free",
      })
      .select()
      .single();

    if (companyError) {
      console.error("建立公司失敗:", companyError);
      return internalError("建立公司失敗");
    }

    // 新增成員記錄
    const { error: memberError } = await supabase
      .from("company_members")
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: "owner",
        status: "active",
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      // 回滾：刪除剛建立的公司
      await supabase.from("companies").delete().eq("id", company.id);
      console.error("新增成員記錄失敗:", memberError);
      return internalError("建立公司失敗");
    }

    // 建立免費訂閱
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    await supabase.from("subscriptions").insert({
      company_id: company.id,
      plan_name: "free",
      status: "active",
      monthly_article_limit: 5,
      articles_used_this_month: 0,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

    return successResponse(company, undefined, HTTP_STATUS.CREATED);
  },
);
