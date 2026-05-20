/**
 * 重試失敗的文章同步任務
 * 由 GitHub Actions 定時執行
 */

import { ArticleSyncService } from "../src/lib/sync/sync-service";

async function main() {
  console.log("========================================");
  console.log("  Process Sync Jobs - 重試失敗的同步任務");
  console.log("========================================");
  console.log(`開始時間: ${new Date().toISOString()}`);
  console.log();

  try {
    const syncService = new ArticleSyncService({
      maxRetries: 3,
      retryDelayMs: 5000,
      timeoutMs: 30000,
      batchSize: 10,
    });

    const result = await syncService.retryFailedSyncs();

    console.log();
    console.log("========================================");
    console.log("  處理結果");
    console.log("========================================");
    console.log(`總計: ${result.total} 個任務`);
    console.log(`成功: ${result.success} 個`);
    console.log(`失敗: ${result.failed} 個`);

    if (result.results.length > 0) {
      console.log();
      console.log("詳細結果:");
      for (const r of result.results) {
        const status = r.success ? "✅" : "❌";
        console.log(
          `  ${status} [${r.sync_target_slug}] 文章 ${r.article_id.substring(0, 8)}... - ${r.action}`
        );
        if (r.error_message) {
          console.log(`     錯誤: ${r.error_message}`);
        }
        if (r.duration_ms) {
          console.log(`     耗時: ${r.duration_ms}ms`);
        }
      }
    } else {
      console.log();
      console.log("沒有待處理的同步任務");
    }

    console.log();
    console.log(`結束時間: ${new Date().toISOString()}`);
    console.log("========================================");

    // 如果有任何失敗，退出碼設為 1
    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("處理同步任務時發生錯誤:", error);
    process.exit(1);
  }
}

main();
