/**
 * 統一圖片上傳入口：僅使用 Cloudflare R2
 */

import { R2Client, getR2Config } from "./r2-client";

export interface ImageUploadResult {
  url: string;
  storage: "r2" | "none";
}

/**
 * 上傳圖片到 R2
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
      console.error(`${logPrefix} ❌ R2 upload failed:`, err.message);
    }
  }

  console.warn(`${logPrefix} ⚠️ R2 not configured or upload failed`);
  return { url: "", storage: "none" };
}
