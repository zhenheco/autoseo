/**
 * 測試 webhook 連線
 * 執行: npx tsx scripts/test-webhook.ts
 */

import crypto from "crypto";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function testWebhook() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ 缺少環境變數");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: target } = await supabase
    .from("website_configs")
    .select("webhook_url, webhook_secret, website_name")
    .eq("external_slug", "onehand")
    .single();

  if (!target || !target.webhook_url) {
    console.log("❌ 找不到一手通設定");
    return;
  }

  console.log(`\n🧪 測試 Webhook 連線: ${target.website_name}`);
  console.log("=".repeat(50));

  const payload = {
    event: "article.created",
    timestamp: new Date().toISOString(),
    article: {
      source_id: "test-" + Date.now(),
      slug: "test-article-" + Date.now(),
      title: "測試文章 - Webhook 連線測試",
      excerpt: "這是一篇測試文章",
      html_content: "<p>測試內容</p>",
      categories: ["測試"],
      tags: ["webhook", "test"],
      language: "zh-TW",
      seo_title: null,
      seo_description: null,
      focus_keyword: null,
      keywords: [],
      featured_image_url: null,
      featured_image_alt: null,
      word_count: 10,
      reading_time: 1,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    metadata: {
      source: "1wayseo",
      version: "1.0",
    },
  };

  const payloadString = JSON.stringify(payload);
  const timestamp = Date.now();

  // 生成簽章
  const signaturePayload = timestamp + "." + payloadString;
  const signature =
    "sha256=" +
    crypto
      .createHmac("sha256", target.webhook_secret || "")
      .update(signaturePayload, "utf8")
      .digest("hex");

  console.log("\n📤 發送到:", target.webhook_url);
  console.log("📝 Event:", payload.event);
  console.log("🔐 Signature:", signature.substring(0, 30) + "...");

  const startTime = Date.now();

  try {
    const response = await fetch(target.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-timestamp": timestamp.toString(),
        "x-webhook-signature": signature,
        "User-Agent": "1waySEO-ArticleSync/1.0",
      },
      body: payloadString,
    });

    const duration = Date.now() - startTime;
    const body = await response.text();

    console.log("\n📥 Response:");
    console.log("   Status:", response.status);
    console.log("   Duration:", duration, "ms");
    console.log("   Body:", body.substring(0, 300));

    if (response.ok) {
      console.log("\n✅ Webhook 測試成功！");
    } else {
      console.log("\n❌ Webhook 測試失敗");
    }
  } catch (error) {
    console.log("\n❌ 連線錯誤:", error);
  }

  console.log("\n" + "=".repeat(50));
}

testWebhook().catch(console.error);
