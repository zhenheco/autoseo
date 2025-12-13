"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateReferralCode } from "@/lib/referral";
import { cookies } from "next/headers";
import {
  performFraudCheckAndRecord,
  saveDeviceFingerprint,
} from "@/lib/fraud-detection";

function generateSlug(email: string): string {
  const username = email.split("@")[0];
  const random = Math.random().toString(36).substring(2, 8);
  return `${username}-${random}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const user = session.user;
      const adminClient = createAdminClient();

      const { data: existingMember } = await adminClient
        .from("company_members")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!existingMember) {
        const { data: company, error: companyError } = await adminClient
          .from("companies")
          .insert({
            name: `${user.email?.split("@")[0] || "User"} 的公司`,
            slug: generateSlug(user.email || "user"),
            owner_id: user.id,
            subscription_tier: "free",
          })
          .select()
          .single();

        if (!companyError && company) {
          await adminClient.from("company_members").insert({
            company_id: company.id,
            user_id: user.id,
            role: "owner",
            status: "active",
          });

          const { data: freePlan } = await adminClient
            .from("subscription_plans")
            .select("id, articles_per_month")
            .eq("name", "FREE")
            .single();

          const articlesPerMonth = freePlan?.articles_per_month || 3;
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          const { error: subscriptionError } = await adminClient
            .from("company_subscriptions")
            .insert({
              company_id: company.id,
              plan_id: freePlan?.id || null,
              status: "active",
              monthly_token_quota: 0,
              monthly_quota_balance: 0,
              purchased_token_balance: 0,
              is_lifetime: false,
              // 篇數制欄位
              subscription_articles_remaining: articlesPerMonth,
              purchased_articles_remaining: 0,
              articles_per_month: articlesPerMonth,
              lifetime_free_articles_limit: articlesPerMonth,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            });

          if (subscriptionError) {
            console.error("[OAuth] 建立訂閱失敗:", subscriptionError);
          }

          const cookieStore = await cookies();
          const affiliateRef = cookieStore.get("affiliate_ref")?.value;

          // 處理推薦碼和詐騙偵測
          const deviceFingerprint = cookieStore.get("device_fp")?.value;

          if (affiliateRef) {
            const { data: referrerCode } = await adminClient
              .from("referral_codes")
              .select("company_id")
              .eq("code", affiliateRef)
              .single();

            if (referrerCode) {
              // 建立推薦關係
              const { data: referral } = await adminClient
                .from("referrals")
                .insert({
                  referrer_company_id: referrerCode.company_id,
                  referred_company_id: company.id,
                  referral_code: affiliateRef,
                  status: "pending",
                })
                .select("id")
                .single();

              // 執行詐騙偵測（非同步，不阻塞）
              performFraudCheckAndRecord({
                referralId: referral?.id,
                referrerCompanyId: referrerCode.company_id,
                referredCompanyId: company.id,
                fingerprintHash: deviceFingerprint,
              }).catch((err) => console.error("[OAuth] 詐騙偵測失敗:", err));
            }
          }

          // 儲存裝置指紋與帳號關聯（即使沒有推薦碼）
          if (deviceFingerprint) {
            saveDeviceFingerprint(deviceFingerprint, company.id).catch((err) =>
              console.error("[OAuth] 儲存指紋失敗:", err),
            );
          }

          try {
            const newReferralCode = generateReferralCode();
            await adminClient.from("referral_codes").insert({
              company_id: company.id,
              code: newReferralCode,
            });
          } catch (e) {
            console.error("[OAuth] 建立推薦碼失敗:", e);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("登入失敗，請稍後再試")}`,
  );
}
