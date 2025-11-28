import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();

    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    console.log("[API] 定期付款功能已停用，系統已改為純終身定價模式");
    return NextResponse.json(
      {
        error: "定期付款功能已停用",
        message: "系統已改為純終身定價模式，請使用一次性付款購買終身方案",
        redirect: "/#pricing",
      },
      { status: 410 },
    );
  } catch (error) {
    console.error("[API] 建立定期定額支付失敗:", error);
    return NextResponse.json(
      { error: "建立定期定額支付失敗" },
      { status: 500 },
    );
  }
}
