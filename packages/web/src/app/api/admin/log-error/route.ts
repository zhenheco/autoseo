/**
 * 前端錯誤報告 API
 * 接收前端發送的錯誤報告，記錄到日誌供 Admin 查看
 */

import { NextRequest, NextResponse } from "next/server";
import { safeJson } from "@/lib/api/request-body";
import { createClient } from "@shared/supabase";

export const dynamic = "force-dynamic";

interface ErrorReport {
  errorType: "API_TIMEOUT" | "DATABASE_ERROR" | "CRITICAL" | "UNKNOWN";
  endpoint?: string;
  errorMessage: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/admin/log-error
 * 接收前端錯誤報告
 */
export async function POST(request: NextRequest) {
  try {
    const bodyResult = await safeJson<ErrorReport>(request);
    if (!bodyResult.success) {
      return NextResponse.json({ success: true, received: false });
    }

    const body = bodyResult.data;

    // 基本驗證
    if (!body.errorType || !body.errorMessage) {
      return NextResponse.json(
        { success: false, error: "缺少必要欄位" },
        { status: 400 },
      );
    }

    // 嘗試取得用戶資訊（可選）
    let userId: string | undefined;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id;
    } catch {
      // 忽略認證錯誤，繼續記錄
    }

    // 記錄錯誤到 console（會被 Vercel 日誌捕獲）
    const logEntry = {
      type: body.errorType,
      endpoint: body.endpoint || "unknown",
      message: body.errorMessage,
      timestamp: body.timestamp || new Date().toISOString(),
      userId: userId || body.userId || "anonymous",
      metadata: body.metadata,
    };

    console.error(`[ERROR_REPORT] ${JSON.stringify(logEntry)}`);

    // 如果是嚴重錯誤，可以發送到 Slack/Discord（未來擴展）
    if (body.errorType === "CRITICAL" && process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 [${body.errorType}] ${body.errorMessage}`,
            attachments: [
              {
                color: "danger",
                fields: [
                  {
                    title: "Endpoint",
                    value: body.endpoint || "N/A",
                    short: true,
                  },
                  { title: "Time", value: body.timestamp, short: true },
                ],
              },
            ],
          }),
        });
      } catch (slackError) {
        console.error("Slack 通知失敗:", slackError);
      }
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error("[API] /admin/log-error error:", error);
    // 即使解析失敗也返回成功，避免前端重試造成更多問題
    return NextResponse.json({ success: true, received: false });
  }
}
