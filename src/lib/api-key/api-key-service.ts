/**
 * API Key 服務
 *
 * 用於外部網站 API 認證的 API Key 生成、驗證和管理
 *
 * 安全設計：
 * - API Key 使用 crypto.randomBytes 生成，確保隨機性
 * - 資料庫只存儲 API Key 的 SHA-256 雜湊值，不存原始 key
 * - API Key 只在建立時返回一次，之後無法查看
 */

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

/** API Key 前綴 */
const API_KEY_PREFIX = "sk_site_";

/** API Key 隨機部分長度（字元數） */
const API_KEY_RANDOM_LENGTH = 32;

/** API Key 完整長度 = 前綴 + 隨機部分 */
const API_KEY_TOTAL_LENGTH = API_KEY_PREFIX.length + API_KEY_RANDOM_LENGTH;

/**
 * 網站資訊（驗證成功時返回）
 */
export interface WebsiteInfo {
  id: string;
  company_id: string;
  website_name: string;
  wordpress_url: string | null;
  site_type: "wordpress" | "platform" | "external";
  is_external_site: boolean;
}

/**
 * 生成新的 API Key
 *
 * @returns 格式為 sk_site_xxxx 的 API Key（32 字元隨機字串）
 */
export async function generateApiKey(): Promise<string> {
  // 生成 16 bytes = 32 hex characters
  const randomBytes = crypto.randomBytes(16);
  const randomPart = randomBytes.toString("hex");

  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * 計算 API Key 的 SHA-256 雜湊值
 *
 * 用於安全存儲，資料庫只存雜湊值
 *
 * @param apiKey - 原始 API Key
 * @returns 64 字元的十六進位雜湊值
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * 檢查 API Key 格式是否正確
 *
 * @param apiKey - 要檢查的字串
 * @returns 格式正確返回 true
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== "string") {
    return false;
  }

  // 檢查長度
  if (apiKey.length !== API_KEY_TOTAL_LENGTH) {
    return false;
  }

  // 檢查前綴
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return false;
  }

  // 檢查隨機部分是否都是有效的 hex 字元
  const randomPart = apiKey.slice(API_KEY_PREFIX.length);
  return /^[a-f0-9]+$/i.test(randomPart);
}

/**
 * 驗證 API Key 並返回網站資訊
 *
 * @param apiKey - 要驗證的 API Key
 * @returns 驗證成功返回網站資訊，失敗返回 null
 */
export async function validateApiKey(
  apiKey: string,
): Promise<WebsiteInfo | null> {
  // 格式檢查
  if (!isValidApiKeyFormat(apiKey)) {
    return null;
  }

  try {
    // 計算雜湊值
    const hashedKey = await hashApiKey(apiKey);

    // 使用 service role 查詢（繞過 RLS）
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("website_configs")
      .select(
        `
        id,
        company_id,
        website_name,
        wordpress_url,
        site_type,
        is_external_site
      `,
      )
      .eq("api_key", hashedKey)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      company_id: data.company_id,
      website_name: data.website_name,
      wordpress_url: data.wordpress_url,
      site_type: (data.site_type as WebsiteInfo["site_type"]) || "wordpress",
      is_external_site: data.is_external_site ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * 為網站重新生成 API Key
 *
 * @param websiteId - 網站 ID
 * @param companyId - 公司 ID（用於驗證所有權）
 * @returns 新的 API Key（明文），或 null（如果失敗）
 */
export async function regenerateApiKey(
  websiteId: string,
  companyId: string,
): Promise<string | null> {
  try {
    // 生成新的 API Key
    const newApiKey = await generateApiKey();
    const hashedKey = await hashApiKey(newApiKey);

    // 更新資料庫
    const supabase = await createClient();

    const { error } = await supabase
      .from("website_configs")
      .update({
        api_key: hashedKey,
        api_key_created_at: new Date().toISOString(),
      })
      .eq("id", websiteId)
      .eq("company_id", companyId);

    if (error) {
      console.error("[API Key] 重新生成失敗:", error.message);
      return null;
    }

    return newApiKey;
  } catch (err) {
    console.error("[API Key] 重新生成錯誤:", err);
    return null;
  }
}

/**
 * 為新網站建立 API Key
 *
 * @param websiteId - 網站 ID
 * @returns 新的 API Key（明文），或 null（如果失敗）
 */
export async function createApiKeyForWebsite(
  websiteId: string,
): Promise<string | null> {
  try {
    // 生成新的 API Key
    const newApiKey = await generateApiKey();
    const hashedKey = await hashApiKey(newApiKey);

    // 更新資料庫
    const supabase = await createClient();

    const { error } = await supabase
      .from("website_configs")
      .update({
        api_key: hashedKey,
        api_key_created_at: new Date().toISOString(),
        is_external_site: true,
        site_type: "external",
      })
      .eq("id", websiteId);

    if (error) {
      console.error("[API Key] 建立失敗:", error.message);
      return null;
    }

    return newApiKey;
  } catch (err) {
    console.error("[API Key] 建立錯誤:", err);
    return null;
  }
}

/**
 * 取得 API Key 的遮罩顯示版本
 *
 * @param apiKey - 原始 API Key
 * @returns 例如 "sk_site_abc1...89ef"
 */
export function maskApiKey(apiKey: string): string {
  if (!isValidApiKeyFormat(apiKey)) {
    return "***";
  }

  const prefix = apiKey.slice(0, API_KEY_PREFIX.length + 4);
  const suffix = apiKey.slice(-4);

  return `${prefix}...${suffix}`;
}
