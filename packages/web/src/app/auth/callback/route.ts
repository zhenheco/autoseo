import { createClient, createAdminClient } from "@shared/supabase";
import { NextResponse } from "next/server";

function generateSlug(email: string): string {
  const username = email.split("@")[0];
  const random = Math.random().toString(36).substring(2, 8);
  return `${username}-${random}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // 防止 Open Redirect：只允許相對路徑
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const user = session.user;
      const adminClient = createAdminClient();

      // 使用 .limit(1) 避免多筆記錄時 .single() 報錯
      const { data: existingMember } = await adminClient
        .from("company_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

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

          // 使用 slug 查詢（與 Email 註冊統一）
          const { data: freePlan } = await adminClient
            .from("subscription_plans")
            .select("id, articles_per_month")
            .eq("slug", "free")
            .single();

          // FREE 方案為一次性額度（3 篇），不會每月重置
          const freeArticles = freePlan?.articles_per_month || 3;

          const { error: subscriptionError } = await adminClient
            .from("company_subscriptions")
            .insert({
              company_id: company.id,
              plan_id: freePlan?.id || null,
              status: "active",
              // Token 制（向後相容，已棄用）
              monthly_token_quota: 0,
              monthly_quota_balance: 0,
              purchased_token_balance: 0,
              is_lifetime: false,
              // 篇數制（FREE 方案為一次性額度，不重置）
              subscription_articles_remaining: freeArticles,
              purchased_articles_remaining: 0,
              articles_per_month: 0, // 0 表示一次性，不會每月重置
              lifetime_free_articles_limit: freeArticles,
              current_period_start: null, // 無週期（一次性）
              current_period_end: null,
            });

          if (subscriptionError) {
            console.error("[OAuth] 建立訂閱失敗:", subscriptionError);
            // 回滾：刪除已建立的公司和成員記錄
            await adminClient
              .from("company_members")
              .delete()
              .eq("company_id", company.id);
            await adminClient.from("companies").delete().eq("id", company.id);
            return NextResponse.redirect(
              `${origin}/login?error=${encodeURIComponent("訂閱建立失敗，請稍後再試")}`,
            );
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
