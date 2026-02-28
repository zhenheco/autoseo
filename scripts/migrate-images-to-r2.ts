/**
 * 圖片遷移腳本：Supabase Storage → Cloudflare R2
 *
 * 功能：
 * - 從 generated_articles 表讀取所有含 Supabase URL 的圖片
 * - 下載每張圖片 → 上傳到 R2 → 更新資料庫 URL
 * - 支援 --dry-run 模式（預設）
 * - 支援斷點續傳（記錄已遷移的 article ID）
 *
 * 用法：
 *   npx tsx scripts/migrate-images-to-r2.ts --dry-run   # 只列出要遷移的圖片
 *   npx tsx scripts/migrate-images-to-r2.ts --execute    # 實際執行遷移
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
const PROGRESS_FILE = path.join(__dirname, ".migrate-r2-progress.json");
const BATCH_SIZE = 50;

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

// ─── 型別 ───────────────────────────────────

interface ContentImage {
  url: string;
  altText?: string;
  suggestedSection?: string;
  width?: number;
  height?: number;
  model?: string;
  prompt?: string;
  [key: string]: unknown;
}

interface ArticleRow {
  id: string;
  featured_image_url: string | null;
  content_images: ContentImage[] | null;
  og_image: string | null;
  twitter_image: string | null;
}

interface ProgressData {
  migratedIds: string[];
  lastUpdated: string;
}

// ─── 工具函式 ───────────────────────────────────

function isSupabaseUrl(url: string): boolean {
  return url.includes("supabase.co/storage");
}

function loadProgress(): ProgressData {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const raw = fs.readFileSync(PROGRESS_FILE, "utf-8");
      return JSON.parse(raw) as ProgressData;
    }
  } catch {
    console.warn("[Migration] ⚠️ Failed to load progress file, starting fresh");
  }
  return { migratedIds: [], lastUpdated: new Date().toISOString() };
}

function saveProgress(progress: ProgressData): void {
  const updated = { ...progress, lastUpdated: new Date().toISOString() };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(updated, null, 2), "utf-8");
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    return pathParts[pathParts.length - 1] || `image-${Date.now()}.jpg`;
  } catch {
    return `image-${Date.now()}.jpg`;
  }
}

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}

async function uploadToR2(buffer: Buffer, filename: string): Promise<string> {
  const fileKey = `images/migrated-${Date.now()}-${filename}`;
  const contentType = guessContentType(filename);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000",
  });

  await s3Client.send(command);
  return `${R2_PUBLIC_URL}/${fileKey}`;
}

async function migrateUrl(url: string): Promise<string> {
  const filename = extractFilenameFromUrl(url);
  const buffer = await downloadImage(url);
  const newUrl = await uploadToR2(buffer, filename);
  return newUrl;
}

// ─── 主程式 ───────────────────────────────────

async function main() {
  const isDryRun = !process.argv.includes("--execute");

  console.log("=".repeat(60));
  console.log(`  圖片遷移：Supabase Storage → Cloudflare R2`);
  console.log(
    `  模式：${isDryRun ? "🔍 DRY RUN（只列出，不執行）" : "🚀 EXECUTE（實際遷移）"}`,
  );
  console.log("=".repeat(60));

  // 檢查環境變數
  if (!isDryRun) {
    if (
      !R2_ACCOUNT_ID ||
      !R2_ACCESS_KEY_ID ||
      !R2_SECRET_ACCESS_KEY ||
      !R2_BUCKET_NAME
    ) {
      console.error("❌ R2 環境變數不完整，無法執行遷移");
      process.exit(1);
    }
  }

  const progress = loadProgress();
  const migratedSet = new Set(progress.migratedIds);
  console.log(`\n📋 已遷移文章數：${migratedSet.size}`);

  // 分批讀取所有文章
  let offset = 0;
  let totalArticles = 0;
  let totalImages = 0;
  let migratedImages = 0;
  let failedImages = 0;

  while (true) {
    const { data: articles, error } = await supabase
      .from("generated_articles")
      .select("id, featured_image_url, content_images, og_image, twitter_image")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ 查詢失敗:", error.message);
      process.exit(1);
    }

    if (!articles || articles.length === 0) break;

    for (const article of articles as ArticleRow[]) {
      // 跳過已遷移的
      if (migratedSet.has(article.id)) continue;

      // 收集需要遷移的 URL
      const urlsToMigrate: { field: string; url: string; index?: number }[] =
        [];

      if (
        article.featured_image_url &&
        isSupabaseUrl(article.featured_image_url)
      ) {
        urlsToMigrate.push({
          field: "featured_image_url",
          url: article.featured_image_url,
        });
      }

      if (article.og_image && isSupabaseUrl(article.og_image)) {
        urlsToMigrate.push({ field: "og_image", url: article.og_image });
      }

      if (article.twitter_image && isSupabaseUrl(article.twitter_image)) {
        urlsToMigrate.push({
          field: "twitter_image",
          url: article.twitter_image,
        });
      }

      if (Array.isArray(article.content_images)) {
        for (let i = 0; i < article.content_images.length; i++) {
          const img = article.content_images[i];
          if (img?.url && isSupabaseUrl(img.url)) {
            urlsToMigrate.push({
              field: "content_images",
              url: img.url,
              index: i,
            });
          }
        }
      }

      if (urlsToMigrate.length === 0) continue;

      totalArticles++;
      totalImages += urlsToMigrate.length;

      if (isDryRun) {
        console.log(`\n📄 Article: ${article.id}`);
        for (const item of urlsToMigrate) {
          const label =
            item.index !== undefined
              ? `${item.field}[${item.index}]`
              : item.field;
          console.log(`   ${label}: ${item.url.substring(0, 80)}...`);
        }
        continue;
      }

      // 實際遷移
      console.log(
        `\n📄 Migrating article: ${article.id} (${urlsToMigrate.length} images)`,
      );

      const updateData: Record<string, unknown> = {};
      let updatedContentImages: ContentImage[] | null = null;
      let articleFailed = false;

      for (const item of urlsToMigrate) {
        try {
          const newUrl = await migrateUrl(item.url);

          if (item.field === "content_images" && item.index !== undefined) {
            // content_images 需要整個陣列一起更新
            if (!updatedContentImages) {
              updatedContentImages = (article.content_images || []).map(
                (img) => ({ ...img }),
              );
            }
            updatedContentImages[item.index] = {
              ...updatedContentImages[item.index],
              url: newUrl,
            };
          } else {
            updateData[item.field] = newUrl;
          }

          migratedImages++;
          console.log(`   ✅ ${item.field}: migrated`);
        } catch (error) {
          const err = error as Error;
          console.error(`   ❌ ${item.field}: ${err.message}`);
          failedImages++;
          articleFailed = true;
        }
      }

      if (updatedContentImages) {
        updateData["content_images"] = updatedContentImages;
      }

      // 更新資料庫
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("generated_articles")
          .update(updateData)
          .eq("id", article.id);

        if (updateError) {
          console.error(`   ❌ DB update failed: ${updateError.message}`);
          articleFailed = true;
        } else {
          console.log(`   ✅ DB updated`);
        }
      }

      // 記錄進度（即使部分失敗也記錄，避免重複處理成功的部分）
      if (!articleFailed) {
        migratedSet.add(article.id);
        saveProgress({ migratedIds: [...migratedSet], lastUpdated: "" });
      }
    }

    offset += BATCH_SIZE;
  }

  // 輸出統計
  console.log("\n" + "=".repeat(60));
  console.log("  遷移統計");
  console.log("=".repeat(60));
  console.log(`  需遷移文章數：${totalArticles}`);
  console.log(`  需遷移圖片數：${totalImages}`);
  if (!isDryRun) {
    console.log(`  成功遷移：${migratedImages}`);
    console.log(`  遷移失敗：${failedImages}`);
    console.log(`  累計已遷移文章：${migratedSet.size}`);
  }
  console.log("=".repeat(60));

  if (isDryRun && totalImages > 0) {
    console.log("\n💡 使用 --execute 參數執行實際遷移：");
    console.log("   npx tsx scripts/migrate-images-to-r2.ts --execute");
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
