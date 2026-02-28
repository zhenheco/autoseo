/**
 * 統一圖片上傳入口：R2 優先，Supabase Storage fallback
 *
 * 使用策略：
 * 1. R2 環境變數完整 → 嘗試上傳到 R2
 * 2. R2 上傳失敗 → fallback 到 Supabase Storage
 * 3. R2 環境變數不存在 → 直接用 Supabase Storage（向下相容）
 */

import { R2Client, getR2Config } from "./r2-client";
import {
  SupabaseStorageClient,
  getSupabaseStorageConfig,
} from "./supabase-storage-client";

export interface ImageUploadResult {
  url: string;
  storage: "r2" | "supabase" | "none";
}

/**
 * 上傳圖片到儲存服務（R2 優先，Supabase fallback）
 *
 * @param base64Data - base64 編碼的圖片資料
 * @param filename - 檔案名稱（不含路徑前綴，例如 `article-hero-1234.jpg`）
 * @param contentType - MIME type，預設 `image/jpeg`
 * @param logPrefix - log 前綴，用於區分來源（例如 `[FeaturedImageAgent]`）
 * @returns 上傳結果，包含 url 和使用的儲存服務
 */
export async function uploadImageToStorage(
  base64Data: string,
  filename: string,
  contentType: string = "image/jpeg",
  logPrefix: string = "[Storage]",
): Promise<ImageUploadResult> {
  // 1. 嘗試 R2
  const r2Config = getR2Config();
  if (r2Config) {
    try {
      console.log(`${logPrefix} 🔄 Uploading to R2...`);
      const r2Client = new R2Client(r2Config);
      const uploaded = await r2Client.uploadImage(
        base64Data,
        filename,
        contentType,
      );
      console.log(`${logPrefix} ☁️ R2 upload successful: ${uploaded.fileKey}`);
      return { url: uploaded.url, storage: "r2" };
    } catch (error) {
      const err = error as Error;
      console.warn(
        `${logPrefix} ⚠️ R2 upload failed, falling back to Supabase:`,
        err.message,
      );
    }
  }

  // 2. Fallback: Supabase Storage
  const supabaseConfig = getSupabaseStorageConfig();
  if (supabaseConfig) {
    try {
      console.log(`${logPrefix} 🔄 Uploading to Supabase Storage...`);
      const supabaseClient = new SupabaseStorageClient(supabaseConfig);
      const uploaded = await supabaseClient.uploadImage(
        base64Data,
        filename,
        contentType,
      );
      console.log(
        `${logPrefix} ☁️ Supabase upload successful: ${uploaded.path}`,
      );
      return { url: uploaded.url, storage: "supabase" };
    } catch (error) {
      const err = error as Error;
      console.warn(`${logPrefix} ⚠️ Supabase upload failed:`, err.message);
    }
  }

  // 3. 兩者都不可用
  console.warn(`${logPrefix} ⚠️ No storage available, keeping original URL`);
  return { url: "", storage: "none" };
}
