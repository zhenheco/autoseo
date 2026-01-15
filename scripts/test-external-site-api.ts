/**
 * 外部網站 API 測試腳本
 *
 * 用法：
 * npx tsx scripts/test-external-site-api.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// 載入環境變數
config({ path: ".env.local" });

// Supabase 設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// 測試用 API Key（明文）- 格式必須是 sk_site_ + 32 hex chars
const TEST_API_KEY = "sk_site_" + crypto.randomBytes(16).toString("hex");

// 計算 hashed key
async function hashApiKey(apiKey: string): Promise<string> {
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  return hash;
}

// 建立 Supabase 客戶端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 顏色輸出
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

function logSuccess(message: string) {
  log(`✓ ${message}`, "green");
}

function logError(message: string) {
  log(`✗ ${message}`, "red");
}

function logInfo(message: string) {
  log(`ℹ ${message}`, "cyan");
}

async function setupTestSite(): Promise<string | null> {
  log("\n=== 設定測試網站 ===", "blue");

  // 查找一個公司
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .limit(1)
    .single();

  if (!company) {
    logError("找不到公司，請先建立公司");
    return null;
  }

  logInfo(`使用公司: ${company.name} (${company.id})`);

  // 檢查是否已有測試網站
  const { data: existingSite } = await supabase
    .from("website_configs")
    .select("id")
    .eq("website_name", "API Test Site")
    .eq("is_external_site", true)
    .single();

  if (existingSite) {
    logInfo("找到現有測試網站，更新 API Key...");

    const hashedKey = await hashApiKey(TEST_API_KEY);
    await supabase
      .from("website_configs")
      .update({
        api_key: hashedKey,
        api_key_created_at: new Date().toISOString(),
      })
      .eq("id", existingSite.id);

    return existingSite.id;
  }

  // 建立測試網站
  const hashedKey = await hashApiKey(TEST_API_KEY);
  const { data: site, error } = await supabase
    .from("website_configs")
    .insert({
      company_id: company.id,
      website_name: "API Test Site",
      wordpress_url: "https://test-api.example.com",
      site_type: "external",
      is_external_site: true,
      wp_enabled: false,
      api_key: hashedKey,
      api_key_created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    logError(`建立測試網站失敗: ${error.message}`);
    return null;
  }

  logSuccess(`測試網站已建立: ${site.id}`);
  return site.id;
}

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  expectedStatus: number,
  body?: object
): Promise<boolean> {
  try {
    const url = `${BASE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (response.status === expectedStatus) {
      logSuccess(`${name}: ${response.status} ${response.statusText}`);
      if (data.articles) {
        logInfo(`  → 返回 ${data.articles.length} 篇文章`);
      }
      if (data.categories) {
        logInfo(`  → 返回 ${data.categories.length} 個分類`);
      }
      if (data.tags) {
        logInfo(`  → 返回 ${data.tags.length} 個標籤`);
      }
      if (data.languages) {
        logInfo(`  → 返回 ${data.languages.length} 個語系`);
      }

      // 檢查 Rate Limit headers
      const rateLimit = {
        limit: response.headers.get("X-RateLimit-Limit"),
        remaining: response.headers.get("X-RateLimit-Remaining"),
        used: response.headers.get("X-RateLimit-Used"),
      };
      if (rateLimit.limit) {
        logInfo(
          `  → Rate Limit: ${rateLimit.used}/${rateLimit.limit} (剩餘 ${rateLimit.remaining})`
        );
      }

      return true;
    } else {
      logError(
        `${name}: 預期 ${expectedStatus}, 實際 ${response.status}`
      );
      logInfo(`  → ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`${name}: ${error}`);
    return false;
  }
}

async function testInvalidAuth(): Promise<boolean> {
  log("\n=== 測試無效認證 ===", "blue");

  try {
    const response = await fetch(`${BASE_URL}/api/v1/sites/articles`, {
      headers: {
        Authorization: "Bearer invalid_key_123",
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      logSuccess("無效 API Key 正確返回 401");
      return true;
    } else {
      logError(`預期 401, 實際 ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`認證測試失敗: ${error}`);
    return false;
  }
}

async function testMissingAuth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/sites/articles`);

    if (response.status === 401) {
      logSuccess("缺少 Authorization header 正確返回 401");
      return true;
    } else {
      logError(`預期 401, 實際 ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`認證測試失敗: ${error}`);
    return false;
  }
}

async function cleanup(siteId: string) {
  log("\n=== 清理測試資料 ===", "blue");

  // 刪除 API 使用量記錄
  await supabase.from("external_site_api_logs").delete().eq("website_id", siteId);
  logInfo("已清理 API 使用量記錄");

  // 可選：刪除測試網站
  // await supabase.from('website_configs').delete().eq('id', siteId);
  // logInfo('已刪除測試網站');
}

async function main() {
  log("\n🧪 外部網站 API 整合測試", "yellow");
  log("=".repeat(50), "yellow");

  // 檢查環境變數
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logError("請設定 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 環境變數");
    process.exit(1);
  }

  logInfo(`測試目標: ${BASE_URL}`);
  logInfo(`API Key: ${TEST_API_KEY}`);
  logInfo(`API Key 長度: ${TEST_API_KEY.length}`);
  const keyHash = await hashApiKey(TEST_API_KEY);
  logInfo(`API Key Hash: ${keyHash}`);

  // 設定測試網站
  const siteId = await setupTestSite();
  if (!siteId) {
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  // 測試認證
  log("\n=== 測試認證 ===", "blue");
  (await testInvalidAuth()) ? passed++ : failed++;
  (await testMissingAuth()) ? passed++ : failed++;

  // 測試 API 端點
  log("\n=== 測試 API 端點 ===", "blue");

  // 文章列表
  (await testEndpoint(
    "GET /articles",
    "GET",
    "/api/v1/sites/articles",
    200
  ))
    ? passed++
    : failed++;

  // 文章列表（帶參數）
  (await testEndpoint(
    "GET /articles?page=1&limit=5",
    "GET",
    "/api/v1/sites/articles?page=1&limit=5",
    200
  ))
    ? passed++
    : failed++;

  // 文章列表（語系篩選）
  (await testEndpoint(
    "GET /articles?lang=zh-TW",
    "GET",
    "/api/v1/sites/articles?lang=zh-TW",
    200
  ))
    ? passed++
    : failed++;

  // 分類列表
  (await testEndpoint(
    "GET /categories",
    "GET",
    "/api/v1/sites/categories",
    200
  ))
    ? passed++
    : failed++;

  // 標籤列表
  (await testEndpoint("GET /tags", "GET", "/api/v1/sites/tags", 200))
    ? passed++
    : failed++;

  // 語系列表
  (await testEndpoint(
    "GET /languages",
    "GET",
    "/api/v1/sites/languages",
    200
  ))
    ? passed++
    : failed++;

  // 單篇文章（不存在）
  (await testEndpoint(
    "GET /articles/non-existent-slug",
    "GET",
    "/api/v1/sites/articles/non-existent-slug-12345",
    404
  ))
    ? passed++
    : failed++;

  // 清理
  await cleanup(siteId);

  // 結果摘要
  log("\n" + "=".repeat(50), "yellow");
  log("📊 測試結果摘要", "yellow");
  log(`   通過: ${passed}`, "green");
  log(`   失敗: ${failed}`, failed > 0 ? "red" : "green");
  log("=".repeat(50), "yellow");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
