import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth-guard";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  if (!isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "無權限" }, { status: 403 });
  }

  const { data: affiliates, error } = await supabase
    .from("affiliates")
    .select(
      `
      *,
      companies (
        id,
        name
      ),
      affiliate_tiers (
        tier_name,
        commission_rate
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Admin] 查詢聯盟夥伴失敗:", error);
    return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
  }

  return NextResponse.json({ data: affiliates });
}
