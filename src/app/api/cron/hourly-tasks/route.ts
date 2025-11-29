import { NextRequest, NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/article-processor";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentHour = new Date().getUTCHours();
  const results: Record<
    string,
    { status: string; error: string | null; details?: unknown }
  > = {
    processScheduledArticles: { status: "pending", error: null },
    processPendingJobs: { status: "pending", error: null },
  };

  console.log(`[Hourly Tasks] 開始執行 (UTC 小時: ${currentHour})`);

  try {
    console.log("[Hourly Tasks] 處理排程發布文章...");
    try {
      const scheduledArticlesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/cron/process-scheduled-articles`,
        {
          headers: { authorization: authHeader },
        },
      );

      if (scheduledArticlesResponse.ok) {
        const data = await scheduledArticlesResponse.json();
        results.processScheduledArticles.status = "completed";
        results.processScheduledArticles.details = data;
        console.log("[Hourly Tasks] 排程發布完成:", data);
      } else {
        results.processScheduledArticles.status = "failed";
        results.processScheduledArticles.error = `HTTP ${scheduledArticlesResponse.status}`;
        console.error(
          "[Hourly Tasks] 排程發布失敗:",
          scheduledArticlesResponse.status,
        );
      }
    } catch (err) {
      results.processScheduledArticles.status = "failed";
      results.processScheduledArticles.error =
        err instanceof Error ? err.message : "Unknown error";
      console.error("[Hourly Tasks] 排程發布錯誤:", err);
    }

    console.log("[Hourly Tasks] 處理待處理的文章生成任務...");
    try {
      const jobsResult = await processPendingJobs();
      results.processPendingJobs.status = "completed";
      results.processPendingJobs.details = jobsResult;
      console.log("[Hourly Tasks] 待處理任務處理完成:", jobsResult);
    } catch (err) {
      results.processPendingJobs.status = "failed";
      results.processPendingJobs.error =
        err instanceof Error ? err.message : "Unknown error";
      console.error("[Hourly Tasks] 待處理任務錯誤:", err);
    }

    if (currentHour === 9) {
      console.log("[Hourly Tasks] 執行每日任務 (09:00 UTC)...");

      results.syncModels = { status: "pending", error: null };
      results.unlockCommissions = { status: "pending", error: null };
      results.checkInactiveAffiliates = { status: "pending", error: null };

      try {
        const syncModelsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/cron/sync-models`,
          {
            headers: { authorization: authHeader },
          },
        );

        if (syncModelsResponse.ok) {
          results.syncModels.status = "completed";
          console.log("[Hourly Tasks] 同步 AI 模型完成");
        } else {
          results.syncModels.status = "failed";
          results.syncModels.error = `HTTP ${syncModelsResponse.status}`;
        }
      } catch (err) {
        results.syncModels.status = "failed";
        results.syncModels.error =
          err instanceof Error ? err.message : "Unknown error";
      }

      try {
        const unlockResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/cron/unlock-commissions`,
          {
            headers: { authorization: authHeader },
          },
        );

        if (unlockResponse.ok) {
          results.unlockCommissions.status = "completed";
          console.log("[Hourly Tasks] 解鎖佣金完成");
        } else {
          results.unlockCommissions.status = "failed";
          results.unlockCommissions.error = `HTTP ${unlockResponse.status}`;
        }
      } catch (err) {
        results.unlockCommissions.status = "failed";
        results.unlockCommissions.error =
          err instanceof Error ? err.message : "Unknown error";
      }

      try {
        const checkAffiliatesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/cron/check-inactive-affiliates`,
          {
            headers: { authorization: authHeader },
          },
        );

        if (checkAffiliatesResponse.ok) {
          results.checkInactiveAffiliates.status = "completed";
          console.log("[Hourly Tasks] 檢查不活躍聯盟完成");
        } else {
          results.checkInactiveAffiliates.status = "failed";
          results.checkInactiveAffiliates.error = `HTTP ${checkAffiliatesResponse.status}`;
        }
      } catch (err) {
        results.checkInactiveAffiliates.status = "failed";
        results.checkInactiveAffiliates.error =
          err instanceof Error ? err.message : "Unknown error";
      }
    }

    console.log("[Hourly Tasks] 所有任務執行完成");
    return NextResponse.json({
      success: true,
      currentHour,
      isDailyRun: currentHour === 9,
      results,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Hourly Tasks] 錯誤:", error);
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
