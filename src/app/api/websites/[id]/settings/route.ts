import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    // 取得用戶的公司
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "找不到公司資料" }, { status: 404 });
    }

    // 取得網站設定（確保屬於用戶的公司）
    const { data: website, error } = await supabase
      .from("website_configs")
      .select("id, industry, region, language")
      .eq("id", websiteId)
      .eq("company_id", membership.company_id)
      .single();

    if (error || !website) {
      return NextResponse.json({ error: "找不到網站" }, { status: 404 });
    }

    return NextResponse.json({
      industry: website.industry || "",
      region: website.region || "",
      language: website.language || "",
    });
  } catch (error) {
    console.error("獲取網站設定錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
