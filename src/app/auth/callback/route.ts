"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateReferralCode } from "@/lib/referral";
import { cookies } from "next/headers";

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

          await adminClient.from("company_subscriptions").insert({
            company_id: company.id,
            plan_id: null,
            status: "active",
            monthly_token_quota: 0,
            monthly_quota_balance: 0,
            purchased_token_balance: 1000,
            is_lifetime: false,
          });

          const cookieStore = await cookies();
          const affiliateRef = cookieStore.get("affiliate_ref")?.value;

          if (affiliateRef) {
            const { data: referralCode } = await adminClient
              .from("company_referral_codes")
              .select("company_id")
              .eq("code", affiliateRef)
              .single();

            if (referralCode) {
              await adminClient.from("affiliate_referrals").insert({
                referrer_company_id: referralCode.company_id,
                referred_company_id: company.id,
                referral_code: affiliateRef,
                status: "pending",
              });
            }
          }

          try {
            const newReferralCode = generateReferralCode();
            await adminClient.from("company_referral_codes").insert({
              company_id: company.id,
              code: newReferralCode,
              is_active: true,
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
