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

async function cleanAllJobs() {
  console.log("開始清理所有 pending 和 processing 任務...\n");

  // 標記所有 pending 和 processing 任務為 cancelled
  const { data, error } = await supabase
    .from("article_jobs")
    .update({
      status: "failed",
      metadata: {
        error: "用戶手動取消所有任務",
        cancelled_at: new Date().toISOString(),
      },
    })
    .in("status", ["pending", "processing"])
    .select("id, metadata");

  if (error) {
    console.error("❌ 清理失敗:", error);
    return;
  }

  console.log(`✅ 成功取消 ${data?.length || 0} 個任務\n`);

  data?.forEach((job, index) => {
    const metadata = job.metadata as any;
    const title = metadata?.title || "Untitled";
    console.log(`${index + 1}. ${title} (${job.id})`);
  });

  console.log("\n🎉 清理完成！現在可以在前端重新提交新的文章任務。");
}

cleanAllJobs();
