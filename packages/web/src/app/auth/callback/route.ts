import { createClient, createAdminClient } from "@shared/supabase";
import { NextResponse } from "next/server";

function generateSlug(email: string): string {
  const username = email.split("@")[0];
  const random = Math.random().toString(36).substring(2, 8);
  return `${username}-${random}`;
}

function safeNextPath(rawNext: string): string {
  return rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // 防止 Open Redirect：只允許相對路徑，並拒絕 protocol-relative URL。
  const next = safeNextPath(rawNext);

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
          })
          .select()
          .single();

        if (!companyError && company) {
          const { error: memberError } = await adminClient
            .from("company_members")
            .insert({
              company_id: company.id,
              user_id: user.id,
              role: "owner",
              status: "active",
            });

          if (memberError) {
            await adminClient.from("companies").delete().eq("id", company.id);
            return NextResponse.redirect(
              `${origin}/login?error=${encodeURIComponent("公司成員建立失敗，請稍後再試")}`,
            );
          }

          const { error: brandError } = await adminClient
            .from("brands")
            .insert({
              company_id: company.id,
              name: company.name,
              is_default: true,
            });

          if (brandError) {
            await adminClient
              .from("company_members")
              .delete()
              .eq("company_id", company.id);
            await adminClient.from("companies").delete().eq("id", company.id);
            return NextResponse.redirect(
              `${origin}/login?error=${encodeURIComponent("預設品牌建立失敗，請稍後再試")}`,
            );
          }

          console.log("[OAuth] 新帳號等待結帳建立訂閱");
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("登入失敗，請稍後再試")}`,
  );
}
