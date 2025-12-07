/**
 * 前端裝置指紋收集工具
 * 使用 ThumbmarkJS 收集瀏覽器指紋
 */

import { getFingerprint } from "@thumbmarkjs/thumbmarkjs";

// Cookie 名稱
const FINGERPRINT_COOKIE_NAME = "device_fp";
const FINGERPRINT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 天（秒）

/**
 * 收集裝置指紋
 * @returns 指紋雜湊值
 */
export async function collectFingerprint(): Promise<string> {
  try {
    const fingerprint = await getFingerprint();
    return fingerprint;
  } catch (error) {
    console.error("指紋收集失敗:", error);
    // 返回一個隨機值作為 fallback
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
}

/**
 * 將指紋儲存到 SessionStorage
 */
export function storeFingerprint(hash: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("device_fp", hash);
  }
}

/**
 * 從 SessionStorage 取得指紋
 */
export function getStoredFingerprint(): string | null {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("device_fp");
  }
  return null;
}

/**
 * 將指紋設定為 Cookie（供後端讀取）
 */
export function setFingerprintCookie(hash: string): void {
  if (typeof document !== "undefined") {
    const isProduction = window.location.protocol === "https:";
    const secure = isProduction ? "; Secure" : "";
    document.cookie = `${FINGERPRINT_COOKIE_NAME}=${hash}; path=/; max-age=${FINGERPRINT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  }
}

/**
 * 從 Cookie 取得指紋
 */
export function getFingerprintFromCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === FINGERPRINT_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * 收集並儲存指紋（一次完成）
 */
export async function collectAndStoreFingerprint(): Promise<string> {
  const fingerprint = await collectFingerprint();

  // 同時儲存到 SessionStorage 和 Cookie
  storeFingerprint(fingerprint);
  setFingerprintCookie(fingerprint);

  return fingerprint;
}

/**
 * 取得指紋（優先從快取取得）
 */
export async function getOrCollectFingerprint(): Promise<string> {
  // 先嘗試從 SessionStorage 取得
  const stored = getStoredFingerprint();
  if (stored) {
    return stored;
  }

  // 再嘗試從 Cookie 取得
  const fromCookie = getFingerprintFromCookie();
  if (fromCookie) {
    storeFingerprint(fromCookie);
    return fromCookie;
  }

  // 最後才收集新的
  return collectAndStoreFingerprint();
}

/**
 * 提交指紋到後端
 */
export async function submitFingerprint(params: {
  fingerprint: string;
  referralCode?: string;
  eventType: "click" | "register" | "login";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/fingerprint/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fingerprint_hash: params.fingerprint,
        referral_code: params.referralCode,
        event_type: params.eventType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || "提交失敗" };
    }

    return { success: true };
  } catch (error) {
    console.error("指紋提交失敗:", error);
    return { success: false, error: "網路錯誤" };
  }
}
