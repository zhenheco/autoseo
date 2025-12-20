/**
 * Brevo 同步 Cron Job API
 * 每日 UTC 02:00（台灣時間 10:00）執行
 *
 * 功能：
 * - 遍歷所有 company owner 用戶
 * - 同步用戶數據到 Brevo Contacts
 * - 自動計算分群並加入對應 List
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllUsersToBrevo } from "@/lib/brevo";

/**
 * 驗證 Cron Secret
 * Vercel Cron Jobs 會自動帶上 Authorization header
 */
function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");

  // Vercel Cron Jobs 使用 Bearer token
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    return token === process.env.CRON_SECRET;
  }

  return false;
}

export async function GET(request: NextRequest) {
  // 驗證請求來源
  if (!validateCronSecret(request)) {
    console.error("[Cron Brevo] 未授權的請求");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron Brevo] 開始執行每日同步");
  const startTime = Date.now();

  try {
    const result = await syncAllUsersToBrevo();

    const duration = Date.now() - startTime;
    console.log(
      `[Cron Brevo] 完成同步，耗時 ${duration}ms: ${result.synced} 成功, ${result.errors} 失敗, ${result.skipped} 跳過`,
    );

    return NextResponse.json({
      success: true,
      ...result,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[Cron Brevo] 同步失敗", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知錯誤",
      },
      { status: 500 },
    );
  }
}

// 支援 POST 請求（手動觸發測試用）
export async function POST(request: NextRequest) {
  return GET(request);
}
