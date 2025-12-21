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

async function checkJobs() {
  const { data, error } = await supabase
    .from("article_jobs")
    .select("id, keywords, status, created_at, started_at, metadata")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("\n最近 10 個任務：\n");
  data?.forEach((job, index) => {
    const metadata = job.metadata as any;
    const displayTitle =
      metadata?.title ||
      job.title ||
      (job.keywords && job.keywords[0]) ||
      "Untitled";
    console.log(`${index + 1}. [${job.status}] ${displayTitle}`);
    console.log(`   ID: ${job.id}`);
    console.log(
      `   建立時間: ${new Date(job.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    );
    console.log(
      `   開始時間: ${job.started_at ? new Date(job.started_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "尚未開始"}`,
    );
    console.log("");
  });
}

checkJobs();
