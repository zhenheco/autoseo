import { NextRequest, NextResponse } from "next/server";

/**
 * 每日定時任務合併端點
 * 解決 Vercel 免費版只允許 2 個 Cron Jobs 的限制
 *
 * 執行順序：
 * 1. 處理排程發布文章
 * 2. 同步 AI 模型
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, { status: string; error: string | null }> = {
    processScheduledArticles: { status: "pending", error: null },
    syncModels: { status: "pending", error: null },
  };

  try {
    // 任務 1: 處理排程發布文章
    console.log("[Daily Tasks] Starting process-scheduled-articles...");
    try {
      const scheduledArticlesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/cron/process-scheduled-articles`,
        {
          headers: { authorization: authHeader },
        },
      );

      if (scheduledArticlesResponse.ok) {
        results.processScheduledArticles.status = "completed";
        console.log("[Daily Tasks] process-scheduled-articles completed");
      } else {
        results.processScheduledArticles.status = "failed";
        results.processScheduledArticles.error = `HTTP ${scheduledArticlesResponse.status}`;
        console.error(
          "[Daily Tasks] process-scheduled-articles failed:",
          scheduledArticlesResponse.status,
        );
      }
    } catch (err) {
      results.processScheduledArticles.status = "failed";
      results.processScheduledArticles.error =
        err instanceof Error ? err.message : "Unknown error";
      console.error("[Daily Tasks] process-scheduled-articles error:", err);
    }

    // 任務 2: 同步 AI 模型
    console.log("[Daily Tasks] Starting sync-models...");
    const syncModelsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/cron/sync-models`,
      {
        headers: { authorization: authHeader },
      },
    );

    if (syncModelsResponse.ok) {
      results.syncModels.status = "completed";
      console.log("[Daily Tasks] sync-models completed");
    } else {
      throw new Error(`sync-models failed: ${syncModelsResponse.status}`);
    }

    console.log("[Daily Tasks] All tasks completed successfully");
    return NextResponse.json({
      success: true,
      results,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Daily Tasks] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      },
      { status: 500 },
    );
  }
}
