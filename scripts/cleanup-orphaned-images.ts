/**
 * 清理孤立圖片腳本：掃描 R2 bucket，找出未被任何文章引用的圖片
 *
 * 功能：
 * - 列出 R2 bucket 中所有 images/ 下的檔案
 * - 比對資料庫中所有 featured_image_url 和 content_images
 * - 找出沒有任何文章引用的孤立圖片
 * - 預設 dry-run，需要 --execute 才會實際刪除
 *
 * 用法：
 *   npx tsx scripts/cleanup-orphaned-images.ts              # dry-run（預設）
 *   npx tsx scripts/cleanup-orphaned-images.ts --execute     # 實際刪除孤立圖片
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

config({ path: ".env.local" });

// ─── 配置 ───────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim() || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim() || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME?.trim() || "";

const R2_PUBLIC_URL = `https://pub-${R2_ACCOUNT_ID}.r2.dev`;
const LOG_FILE = path.join(
  __dirname,
  `.cleanup-orphaned-${new Date().toISOString().slice(0, 10)}.log`,
);
const BATCH_SIZE = 100;

// ─── 初始化 ───────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  maxAttempts: 3,
});

// ─── 工具函式 ───────────────────────────────────

interface ContentImage {
  url: string;
  [key: string]: unknown;
}

async function listAllR2Images(): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  console.log("[Cleanup] 📂 Listing all R2 images...");

  while (true) {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: "images/",
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
    }

    if (!response.IsTruncated) break;
    continuationToken = response.NextContinuationToken;
  }

  console.log(`[Cleanup] 📦 Found ${keys.length} files in R2`);
  return keys;
}

async function collectReferencedUrls(): Promise<Set<string>> {
  const urls = new Set<string>();
  let offset = 0;

  console.log("[Cleanup] 🔍 Collecting referenced image URLs from database...");

  while (true) {
    const { data: articles, error } = await supabase
      .from("generated_articles")
      .select("featured_image_url, content_images, og_image, twitter_image")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("❌ Query failed:", error.message);
      break;
    }

    if (!articles || articles.length === 0) break;

    for (const article of articles) {
      if (article.featured_image_url) urls.add(article.featured_image_url);
      if (article.og_image) urls.add(article.og_image);
      if (article.twitter_image) urls.add(article.twitter_image);

      if (Array.isArray(article.content_images)) {
        for (const img of article.content_images as ContentImage[]) {
          if (img?.url) urls.add(img.url);
        }
      }
    }

    offset += BATCH_SIZE;
  }

  console.log(`[Cleanup] 📊 Found ${urls.size} referenced URLs in database`);
  return urls;
}

function r2KeyToPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

async function deleteR2Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  await s3Client.send(command);
}

// ─── 主程式 ───────────────────────────────────

async function main() {
  const isExecute = process.argv.includes("--execute");

  console.log("=".repeat(60));
  console.log("  R2 孤立圖片清理");
  console.log(
    `  模式：${isExecute ? "🗑️  EXECUTE（實際刪除）" : "🔍 DRY RUN（只列出）"}`,
  );
  console.log("=".repeat(60));

  // 檢查環境變數
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME
  ) {
    console.error("❌ R2 環境變數不完整");
    process.exit(1);
  }

  // 1. 列出 R2 中所有圖片
  const r2Keys = await listAllR2Images();

  // 2. 收集資料庫中所有被引用的 URL
  const referencedUrls = await collectReferencedUrls();

  // 3. 找出孤立圖片
  const orphanedKeys: string[] = [];
  for (const key of r2Keys) {
    const publicUrl = r2KeyToPublicUrl(key);
    if (!referencedUrls.has(publicUrl)) {
      orphanedKeys.push(key);
    }
  }

  console.log(`\n📊 掃描結果：`);
  console.log(`   R2 總圖片數：${r2Keys.length}`);
  console.log(`   資料庫引用數：${referencedUrls.size}`);
  console.log(`   孤立圖片數：${orphanedKeys.length}`);

  if (orphanedKeys.length === 0) {
    console.log("\n✅ 沒有孤立圖片，無需清理");
    return;
  }

  // 列出孤立圖片
  console.log(`\n🗂️  孤立圖片列表：`);
  const logLines: string[] = [
    `Cleanup run: ${new Date().toISOString()}`,
    `Mode: ${isExecute ? "EXECUTE" : "DRY RUN"}`,
    `Total R2 images: ${r2Keys.length}`,
    `Referenced URLs: ${referencedUrls.size}`,
    `Orphaned images: ${orphanedKeys.length}`,
    "",
    "Orphaned files:",
  ];

  for (const key of orphanedKeys) {
    console.log(`   ${key}`);
    logLines.push(key);
  }

  // 寫入 log
  fs.writeFileSync(LOG_FILE, logLines.join("\n"), "utf-8");
  console.log(`\n📝 清單已寫入：${LOG_FILE}`);

  if (!isExecute) {
    console.log(`\n💡 使用 --execute 參數實際刪除孤立圖片：`);
    console.log(`   npx tsx scripts/cleanup-orphaned-images.ts --execute`);
    return;
  }

  // 實際刪除
  console.log(`\n🗑️  開始刪除 ${orphanedKeys.length} 個孤立圖片...`);
  let deleted = 0;
  let failed = 0;

  for (const key of orphanedKeys) {
    try {
      await deleteR2Object(key);
      deleted++;
      if (deleted % 10 === 0) {
        console.log(`   進度：${deleted}/${orphanedKeys.length}`);
      }
    } catch (error) {
      const err = error as Error;
      console.error(`   ❌ Failed to delete ${key}: ${err.message}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("  清理完成");
  console.log("=".repeat(60));
  console.log(`  成功刪除：${deleted}`);
  console.log(`  刪除失敗：${failed}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
