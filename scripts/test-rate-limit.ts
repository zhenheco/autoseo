/**
 * Rate Limiting 壓力測試
 *
 * 用法：
 * npx tsx scripts/test-rate-limit.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://1wayseo.com";

const TEST_API_KEY = "sk_site_" + crypto.randomBytes(16).toString("hex");

async function hashApiKey(apiKey: string): Promise<string> {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupTestSite(): Promise<string | null> {
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .single();

  if (!company) {
    log("找不到公司", "red");
    return null;
  }

  const { data: site } = await supabase
    .from("website_configs")
    .select("id")
    .eq("website_name", "Rate Limit Test Site")
    .single();

  const hashedKey = await hashApiKey(TEST_API_KEY);

  if (site) {
    await supabase
      .from("website_configs")
      .update({
        api_key: hashedKey,
        api_key_created_at: new Date().toISOString(),
      })
      .eq("id", site.id);
    return site.id;
  }

  const { data: newSite, error } = await supabase
    .from("website_configs")
    .insert({
      company_id: company.id,
      website_name: "Rate Limit Test Site",
      wordpress_url: "https://rate-limit-test.example.com",
      site_type: "external",
      is_external_site: true,
      wp_enabled: false,
      api_key: hashedKey,
      api_key_created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    log(`建立測試網站失敗: ${error.message}`, "red");
    return null;
  }

  return newSite.id;
}

async function makeRequest(): Promise<{
  status: number;
  remaining: number | null;
  used: number | null;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/sites/categories`, {
    headers: {
      Authorization: `Bearer ${TEST_API_KEY}`,
    },
  });

  return {
    status: response.status,
    remaining: parseInt(
      response.headers.get("X-RateLimit-Remaining") || "",
      10
    ) || null,
    used: parseInt(response.headers.get("X-RateLimit-Used") || "", 10) || null,
  };
}

async function main() {
  log("\n🧪 Rate Limiting 壓力測試", "yellow");
  log("=".repeat(50), "yellow");

  const siteId = await setupTestSite();
  if (!siteId) {
    process.exit(1);
  }

  log(`API Key: ${TEST_API_KEY}`, "cyan");
  log(`測試目標: ${BASE_URL}`, "cyan");

  // 發送請求直到達到限制
  log("\n開始發送請求...", "blue");

  let requestCount = 0;
  let hitLimit = false;
  const startTime = Date.now();
  const results: { status: number; remaining: number | null }[] = [];

  // 發送 110 個請求（超過 100 限制）
  const totalRequests = 110;

  for (let i = 0; i < totalRequests; i++) {
    const result = await makeRequest();
    results.push(result);
    requestCount++;

    if (result.status === 429) {
      if (!hitLimit) {
        hitLimit = true;
        log(`\n⚠️  第 ${requestCount} 個請求觸發 Rate Limit (429)`, "yellow");
      }
    } else if (result.status === 200) {
      if (i % 20 === 0 || result.remaining! <= 5) {
        log(
          `   請求 ${requestCount}: 200 OK (剩餘 ${result.remaining})`,
          "green"
        );
      }
    } else {
      log(`   請求 ${requestCount}: ${result.status}`, "red");
    }
  }

  const duration = (Date.now() - startTime) / 1000;

  // 統計結果
  const successCount = results.filter((r) => r.status === 200).length;
  const rateLimitedCount = results.filter((r) => r.status === 429).length;

  log("\n" + "=".repeat(50), "yellow");
  log("📊 測試結果", "yellow");
  log(`   總請求數: ${requestCount}`, "cyan");
  log(`   成功 (200): ${successCount}`, "green");
  log(`   被限制 (429): ${rateLimitedCount}`, "yellow");
  log(`   執行時間: ${duration.toFixed(2)} 秒`, "cyan");

  // 驗證
  if (hitLimit && successCount >= 95 && successCount <= 105) {
    log("\n✅ Rate Limiting 功能正常！", "green");
    log("   - 約 100 個請求後觸發限制", "green");
    log("   - 超過限制的請求正確返回 429", "green");
  } else if (!hitLimit) {
    log("\n❌ Rate Limiting 未觸發！", "red");
    log(`   預期在 100 個請求後觸發，但 ${totalRequests} 個請求都成功`, "red");
  } else {
    log("\n⚠️  Rate Limiting 行為異常", "yellow");
    log(`   成功請求數: ${successCount} (預期約 100)`, "yellow");
  }

  // 清理
  await supabase.from("api_usage_logs").delete().eq("website_id", siteId);
  log("\n已清理測試資料", "cyan");
}

main().catch(console.error);
