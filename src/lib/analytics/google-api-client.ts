/**
 * Google API Client
 *
 * 共用的 Google API 呼叫工具，包含自動 token 刷新機制
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptToken,
  encryptToken,
  refreshGoogleToken,
} from "@/lib/security/token-encryption";
import type { GoogleOAuthToken } from "@/types/google-analytics.types";

/**
 * 取得有效的 access token
 * 如果 token 即將過期或已過期，會自動刷新
 *
 * @param tokenRecord OAuth token 記錄
 * @returns access token 或 null（如果刷新失敗）
 */
export async function getValidAccessToken(
  tokenRecord: GoogleOAuthToken,
): Promise<string | null> {
  const adminClient = createAdminClient();

  // 解密 access token
  let accessToken: string;
  try {
    accessToken = decryptToken(tokenRecord.access_token_encrypted);
  } catch (error) {
    console.error("[Google API Client] 解密 access token 失敗:", error);
    await markTokenAsError(adminClient, tokenRecord.id, "Token 解密失敗");
    return null;
  }

  // 檢查是否需要刷新（提前 5 分鐘刷新）
  const expiresAt = new Date(tokenRecord.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log("[Google API Client] Token 即將過期，開始刷新...");

    // 解密 refresh token
    let refreshToken: string;
    try {
      refreshToken = decryptToken(tokenRecord.refresh_token_encrypted);
    } catch (error) {
      console.error("[Google API Client] 解密 refresh token 失敗:", error);
      await markTokenAsError(
        adminClient,
        tokenRecord.id,
        "Refresh token 解密失敗",
      );
      return null;
    }

    // 刷新 token
    const result = await refreshGoogleToken(refreshToken);

    if (result.error) {
      console.error("[Google API Client] Token 刷新失敗:", result);
      await markTokenAsExpired(
        adminClient,
        tokenRecord.id,
        result.error_description || result.error,
      );
      return null;
    }

    // 更新儲存的 token
    const { error: updateError } = await adminClient
      .from("google_oauth_tokens")
      .update({
        access_token_encrypted: encryptToken(result.access_token),
        token_expires_at: new Date(
          Date.now() + result.expires_in * 1000,
        ).toISOString(),
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRecord.id);

    if (updateError) {
      console.error("[Google API Client] 更新 token 失敗:", updateError);
      // 即使更新失敗，仍然可以使用新的 access token
    }

    return result.access_token;
  }

  return accessToken;
}

/**
 * 呼叫 Google API
 *
 * @param url API URL
 * @param tokenRecord OAuth token 記錄
 * @param options fetch 選項
 * @returns API 回應或錯誤
 */
export async function callGoogleApi<T>(
  url: string,
  tokenRecord: GoogleOAuthToken,
  options: RequestInit = {},
): Promise<{ data?: T; error?: string }> {
  const accessToken = await getValidAccessToken(tokenRecord);

  if (!accessToken) {
    return { error: "無法取得有效的 access token，請重新授權" };
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error?.message || `API 錯誤：${response.status}`;
      console.error(`[Google API Client] ${url} 失敗:`, errorData);
      return { error: errorMessage };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error(`[Google API Client] ${url} 請求失敗:`, error);
    return { error: "網路請求失敗" };
  }
}

/**
 * 取得網站的 OAuth token 記錄
 */
export async function getWebsiteOAuthToken(
  websiteId: string,
  serviceType: "gsc" | "ga4",
): Promise<GoogleOAuthToken | null> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("google_oauth_tokens")
    .select("*")
    .eq("website_id", websiteId)
    .eq("service_type", serviceType)
    .eq("status", "active")
    .single();

  if (error || !data) {
    return null;
  }

  return data as GoogleOAuthToken;
}

/**
 * 標記 token 為錯誤狀態
 */
async function markTokenAsError(
  adminClient: ReturnType<typeof createAdminClient>,
  tokenId: string,
  errorMessage: string,
): Promise<void> {
  await adminClient
    .from("google_oauth_tokens")
    .update({
      status: "error",
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId);
}

/**
 * 標記 token 為過期狀態
 */
async function markTokenAsExpired(
  adminClient: ReturnType<typeof createAdminClient>,
  tokenId: string,
  errorMessage: string,
): Promise<void> {
  await adminClient
    .from("google_oauth_tokens")
    .update({
      status: "expired",
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId);
}

/**
 * 更新最後同步時間
 */
export async function updateLastSyncTime(tokenId: string): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient
    .from("google_oauth_tokens")
    .update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId);
}

/**
 * 取得預設的日期範圍
 * GSC 數據有 3 天延遲
 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3); // GSC 數據有 3 天延遲

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 31); // 預設 28 天

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}
