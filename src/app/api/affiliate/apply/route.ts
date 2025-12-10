import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyForAffiliate } from "@/lib/affiliate-service";
import { generateReferralCode } from "@/lib/referral-service";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";
import type { AffiliateApplyForm } from "@/types/referral.types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 },
      );
    }

    // Rate limiting 檢查
    const rateLimitResponse = await checkRateLimit(
      `affiliate-apply:${user.id}`,
      RATE_LIMIT_CONFIGS.AFFILIATE_APPLY,
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

    const {
      full_name,
      id_number,
      phone,
      email,
      address,
      is_resident,
      agree_terms,
    } = body;

    if (!full_name || !id_number || !phone || !email) {
      return NextResponse.json(
        { success: false, message: "請填寫所有必填欄位" },
        { status: 400 },
      );
    }

    if (!agree_terms) {
      return NextResponse.json(
        { success: false, message: "請同意條款與條件" },
        { status: 400 },
      );
    }

    const idPattern = /^[A-Z][12]\d{8}$/;
    const companyIdPattern = /^\d{8}$/;

    if (!idPattern.test(id_number) && !companyIdPattern.test(id_number)) {
      return NextResponse.json(
        { success: false, message: "身份證字號或統編格式錯誤" },
        { status: 400 },
      );
    }

    const { data: companyMember, error: memberError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !companyMember) {
      return NextResponse.json(
        { success: false, message: "無法取得公司資訊" },
        { status: 400 },
      );
    }

    const form: AffiliateApplyForm = {
      full_name,
      id_number,
      phone,
      email,
      address: address || undefined,
      is_resident: is_resident ?? true,
    };

    const result = await applyForAffiliate(companyMember.company_id, form);

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        already_affiliate: "您已經是聯盟夥伴了",
        account_blocked: "您的帳號已被停權",
        creation_failed: "申請失敗，請稍後再試",
      };
      return NextResponse.json(
        {
          success: false,
          message: errorMessages[result.error || ""] || "申請失敗",
        },
        { status: 400 },
      );
    }

    await generateReferralCode(companyMember.company_id);

    return NextResponse.json({
      success: true,
      message: "申請成功！您已成為聯盟夥伴",
    });
  } catch (error) {
    console.error("API 錯誤:", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 },
    );
  }
}
