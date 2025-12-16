/**
 * Token 加密工具
 *
 * 使用 AES-256-GCM 加密儲存敏感資料
 * 支援 Google OAuth tokens 和 WordPress 密碼等
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 加密金鑰類型
 */
export type EncryptionKeyType = "google" | "wordpress";

/**
 * 取得加密金鑰
 * @param keyType 金鑰類型
 * @throws 如果環境變數未設定或格式不正確
 */
function getEncryptionKey(keyType: EncryptionKeyType = "google"): Buffer {
  const envVarName =
    keyType === "wordpress"
      ? "WORDPRESS_ENCRYPTION_KEY"
      : "GOOGLE_TOKEN_ENCRYPTION_KEY";

  const keyHex = process.env[envVarName];

  if (!keyHex) {
    throw new Error(
      `${envVarName} 環境變數未設定。` +
        "請使用 'openssl rand -hex 32' 生成一個 64 字元的十六進位金鑰。",
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      `${envVarName} 長度錯誤：預期 64 字元，實際 ${keyHex.length} 字元。` +
        "請使用 'openssl rand -hex 32' 生成正確的金鑰。",
    );
  }

  return Buffer.from(keyHex, "hex");
}

/**
 * 加密 token
 * @param plaintext 明文 token
 * @param keyType 金鑰類型（預設為 google）
 * @returns 加密後的字串（格式：iv:authTag:encryptedData，全部 base64 編碼）
 */
export function encryptToken(
  plaintext: string,
  keyType: EncryptionKeyType = "google",
): string {
  const key = getEncryptionKey(keyType);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // 格式: iv:authTag:encryptedData (全部 base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * 解密 token
 * @param ciphertext 加密的字串
 * @param keyType 金鑰類型（預設為 google）
 * @returns 解密後的明文 token
 * @throws 如果格式不正確或解密失敗
 */
export function decryptToken(
  ciphertext: string,
  keyType: EncryptionKeyType = "google",
): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("加密 token 格式不正確");
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const key = getEncryptionKey(keyType);
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * 加密 WordPress 密碼
 * @param password 明文密碼
 * @returns 加密後的字串
 */
export function encryptWordPressPassword(password: string): string {
  return encryptToken(password, "wordpress");
}

/**
 * 解密 WordPress 密碼
 * @param encryptedPassword 加密的密碼
 * @returns 明文密碼
 */
export function decryptWordPressPassword(encryptedPassword: string): string {
  return decryptToken(encryptedPassword, "wordpress");
}

/**
 * 檢查字串是否為加密格式
 * @param value 要檢查的字串
 * @returns 是否為加密格式
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * 刷新 Google OAuth token
 * @param refreshToken refresh token
 * @returns 新的 access token 和過期時間
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      access_token: "",
      expires_in: 0,
      error: "configuration_error",
      error_description: "Google OAuth 憑證未設定",
    };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        access_token: "",
        expires_in: 0,
        error: data.error || "token_refresh_failed",
        error_description: data.error_description || "Token 刷新失敗",
      };
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error("[Token Refresh] 請求失敗:", error);
    return {
      access_token: "",
      expires_in: 0,
      error: "network_error",
      error_description: "網路請求失敗",
    };
  }
}

/**
 * 取得 Google 用戶資訊
 * @param accessToken access token
 * @returns 用戶資訊或 null
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  picture?: string;
} | null> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      console.error("[Google User Info] 請求失敗:", response.status);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("[Google User Info] 請求錯誤:", error);
    return null;
  }
}

/**
 * 撤銷 Google OAuth token
 * @param token access token 或 refresh token
 * @returns 是否成功
 */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    return response.ok;
  } catch (error) {
    console.error("[Token Revoke] 撤銷失敗:", error);
    return false;
  }
}
