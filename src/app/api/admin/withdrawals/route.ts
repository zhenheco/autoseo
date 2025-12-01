import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "無權限" }, { status: 403 });
  }

  const { data: withdrawals, error } = await supabase
    .from("affiliate_withdrawals")
    .select(
      `
      *,
      affiliates (
        id,
        companies (
          id,
          name
        )
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Admin] 查詢提領記錄失敗:", error);
    return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
  }

  return NextResponse.json({ data: withdrawals });
}
