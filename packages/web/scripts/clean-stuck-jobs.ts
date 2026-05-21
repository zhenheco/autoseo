#!/usr/bin/env tsx

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

// 載入環境變數
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ 缺少必要環境變數 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function cleanStuckJobs() {
  // 要清理的測試任務 ID
  const testJobIds = [
    "b0000000-0000-0000-0000-000000000001",
    "a9876543-21ba-fedc-0123-456789abcdef",
    "3491510c-f04c-43da-b67f-fde469e0ac7c",
  ];

  console.log("開始清理卡住的測試任務...\n");

  for (const jobId of testJobIds) {
    const { error } = await supabase
      .from("article_jobs")
      .update({
        status: "failed",
        metadata: {
          error: "手動清理：測試任務卡住",
          cleaned_at: new Date().toISOString(),
        },
      })
      .eq("id", jobId);

    if (error) {
      console.error(`❌ 清理失敗 ${jobId}:`, error.message);
    } else {
      console.log(`✅ 已標記為 failed: ${jobId}`);
    }
  }

  console.log("\n清理完成！");
  console.log("現在你的新任務應該會被優先處理。");
}

cleanStuckJobs();
