/**
 * 同步社群帳號 API
 *
 * POST /api/social/accounts/sync - 從發文小助手 API 同步帳號資訊
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBasClientFromConfig } from "@/lib/social/bas-client";

export async function POST() {
  try {
    const supabase = await createClient();

    // 取得當前用戶
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 取得用戶的公司 ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "找不到公司資訊" }, { status: 404 });
    }

    // 取得社群設定
    const { data: config, error: configError } = await supabase
      .from("social_account_configs")
      .select("*")
      .eq("company_id", profile.company_id)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: "請先設定發文小助手 API Key" },
        { status: 400 },
      );
    }

    // 建立發文小助手 API Client
    const basClient = createBasClientFromConfig({
      bas_api_key: config.bas_api_key,
      bas_user_id: config.bas_user_id,
    });

    // 從發文小助手 API 取得帳號列表
    const response = await basClient.getAccounts();

    if (!response.success) {
      return NextResponse.json(
        { error: "無法從發文小助手取得帳號列表" },
        { status: 500 },
      );
    }

    // 清除舊的帳號快取
    await supabase
      .from("social_accounts")
      .delete()
      .eq("company_id", profile.company_id);

    // 儲存新的帳號資訊
    if (response.data && response.data.length > 0) {
      const accountsToInsert = response.data.map((account) => ({
        company_id: profile.company_id,
        config_id: config.id,
        platform: account.platform,
        account_id: account.id,
        account_name: account.username,
        page_id: account.pageId,
        page_name: account.pageName,
        followers_count: account.followersCount,
        synced_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("social_accounts")
        .insert(accountsToInsert);

      if (insertError) {
        throw new Error(`儲存帳號失敗: ${insertError.message}`);
      }
    }

    // 更新最後同步時間
    await supabase
      .from("social_account_configs")
      .update({
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return NextResponse.json({
      success: true,
      message: "帳號同步完成",
      accountsCount: response.data?.length || 0,
    });
  } catch (error) {
    console.error("[API] 同步社群帳號失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "同步社群帳號失敗",
      },
      { status: 500 },
    );
  }
}
