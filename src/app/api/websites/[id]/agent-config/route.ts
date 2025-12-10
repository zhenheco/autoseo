import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type {
  UpdateAgentConfigRequest,
  UpdateAgentConfigResponse,
} from "@/types/ai-models";

/**
 * 驗證用戶是否有權限存取該網站
 * @param supabase Supabase client
 * @param userId 用戶 ID
 * @param websiteId 網站 ID
 * @returns 驗證結果
 */
async function verifyWebsiteAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  websiteId: string,
): Promise<{ success: boolean; error?: string; status?: number }> {
  // 查詢網站所屬公司
  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    return { success: false, error: "網站不存在", status: 404 };
  }

  // 驗證用戶是否為該公司的活躍成員
  const { data: membership, error: memberError } = await supabase
    .from("company_members")
    .select("id")
    .eq("company_id", website.company_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (memberError || !membership) {
    return { success: false, error: "無權限存取此網站", status: 403 };
  }

  return { success: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    const { id: websiteId } = await params;

    // 驗證用戶有權限存取該網站
    const accessCheck = await verifyWebsiteAccess(supabase, user.id, websiteId);
    if (!accessCheck.success) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status },
      );
    }

    // 查詢 agent config
    const { data: agentConfig, error } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("website_id", websiteId)
      .single();

    if (error) {
      console.error("[Agent Config API] Error:", error);
      return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }

    if (!agentConfig) {
      return NextResponse.json({ error: "設定不存在" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      config: agentConfig,
    });
  } catch (error) {
    console.error("[Agent Config API] Unexpected error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    const { id: websiteId } = await params;

    // 驗證用戶有權限存取該網站
    const accessCheck = await verifyWebsiteAccess(supabase, user.id, websiteId);
    if (!accessCheck.success) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status },
      );
    }

    const body: UpdateAgentConfigRequest = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.complex_processing_model !== undefined) {
      updates.complex_processing_model = body.complex_processing_model;
    }
    if (body.simple_processing_model !== undefined) {
      updates.simple_processing_model = body.simple_processing_model;
    }
    if (body.image_model !== undefined) {
      updates.image_model = body.image_model;
    }
    if (body.research_model !== undefined) {
      updates.research_model = body.research_model;
    }
    if (body.meta_model !== undefined) {
      updates.meta_model = body.meta_model;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "沒有需要更新的欄位" },
        { status: 400 },
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedConfig, error } = await supabase
      .from("agent_configs")
      .update(updates)
      .eq("website_id", websiteId)
      .select("*")
      .single();

    if (error) {
      console.error("[Agent Config API] Update failed:", error);
      return NextResponse.json({ error: "更新失敗" }, { status: 500 });
    }

    const response: UpdateAgentConfigResponse = {
      success: true,
      config: updatedConfig,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Agent Config API] Unexpected error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
