#!/usr/bin/env tsx
/**
 * 快速測試文章生成（不發布到 WordPress）
 * Usage: DOTENV_CONFIG_PATH=.env.local pnpm tsx scripts/test-generate.ts "關鍵字"
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ParallelOrchestrator } from "../src/lib/agents/orchestrator";
import { v4 as uuidv4 } from "uuid";

async function main() {
  const keyword = process.argv[2] || "大腦營行";

  // Platform Blog 設定
  const websiteId = "d3d18bd5-ebb5-4a7f-8cba-97bed4a19168";
  const companyId = "1c9c2d1d-3b26-4ab1-971f-98a980fdbce9";

  console.log(`=== 測試文章生成 ===`);
  console.log(`關鍵字: ${keyword}`);
  console.log(`Website: Platform Blog (1wayseo.com)\n`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const orchestrator = new ParallelOrchestrator(supabase);
  const startTime = Date.now();

  try {
    const result = await orchestrator.execute({
      title: keyword,
      websiteId,
      companyId,
      articleJobId: uuidv4(),
      region: "zh-TW",
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== 生成完成（${elapsed}s）===\n`);

    if (result.success) {
      console.log("✅ 生成成功");
      console.log("標題:", result.meta?.seo?.title);
      console.log("描述:", result.meta?.seo?.description);
      console.log("字數:", result.content?.length || 0, "字元");

      // 顯示 token 使用量
      if (result.tokenUsage) {
        console.log("\n📊 Token 使用量:");
        console.log("  總 prompt tokens:", result.tokenUsage.totalPromptTokens);
        console.log(
          "  總 completion tokens:",
          result.tokenUsage.totalCompletionTokens,
        );
        console.log("  總 tokens:", result.tokenUsage.totalTokens);
      }
    } else {
      console.log("❌ 生成失敗:", result.error);
    }
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ 錯誤（${elapsed}s）:`, error);
  }
}

main();
