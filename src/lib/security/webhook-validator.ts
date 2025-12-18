/**
 * Webhook 簽章驗證工具
 * 使用 HMAC SHA256 驗證 webhook 請求的真實性
 */

import crypto from "crypto";
import { Redis } from "@upstash/redis";

/**
 * 驗證 HMAC SHA256 簽章
 *
 * @param payload - 原始請求內容
 * @param signature - 收到的簽章
 * @param secret - 共享密鑰
 * @returns 簽章是否有效
 */
export function verifyHmacSha256(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature),
    );
  } catch {
    return false;
  }
}

/**
 * 驗證藍新金流 (NewebPay) 回調簽章
 *
 * @param tradeInfo - 交易資料
 * @param tradeSha - 收到的簽章
 * @param hashKey - HashKey
 * @param hashIV - HashIV
 * @returns 簽章是否有效
 */
export function verifyNewebPayCallback(
  tradeInfo: string,
  tradeSha: string,
  hashKey: string,
  hashIV: string,
): boolean {
  if (!tradeInfo || !tradeSha || !hashKey || !hashIV) {
    return false;
  }

  try {
    const checkValue = crypto
      .createHash("sha256")
      .update(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`)
      .digest("hex")
      .toUpperCase();

    return crypto.timingSafeEqual(
      Buffer.from(tradeSha.toUpperCase()),
      Buffer.from(checkValue),
    );
  } catch {
    return false;
  }
}

/**
 * 驗證請求時間戳,防止重放攻擊
 *
 * @param timestamp - 請求時間戳 (Unix timestamp in seconds 或 ISO string)
 * @param maxAgeSeconds - 最大允許時間差 (秒),預設 300 秒 (5 分鐘)
 * @returns 時間戳是否在有效範圍內
 */
export function verifyTimestamp(
  timestamp: string | number,
  maxAgeSeconds: number = 300,
): boolean {
  if (!timestamp) {
    return false;
  }

  try {
    let requestTime: number;

    if (typeof timestamp === "string") {
      requestTime = new Date(timestamp).getTime();
    } else {
      requestTime = timestamp * 1000;
    }

    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime) / 1000;

    return timeDiff <= maxAgeSeconds;
  } catch {
    return false;
  }
}

/**
 * 生成隨機 nonce (用於防重放攻擊)
 *
 * @param length - nonce 長度 (預設 32)
 * @returns 隨機 nonce 字串
 */
export function generateNonce(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Upstash Redis 客戶端（延遲初始化）
 */
let redis: Redis | null = null;

/**
 * 記憶體快取作為備援（Redis 不可用時使用）
 */
const memoryNonceCache = new Map<string, number>();

/**
 * 取得 Redis 客戶端
 */
function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redis;
}

/**
 * 檢查並記錄 nonce，防止重放攻擊
 * 優先使用 Redis，不可用時使用記憶體快取
 *
 * @param nonce - 要檢查的 nonce
 * @param ttlSeconds - nonce 有效期 (秒)，預設 300 秒
 * @returns nonce 是否有效 (未使用過)
 */
export async function checkAndRecordNonce(
  nonce: string,
  ttlSeconds: number = 300,
): Promise<boolean> {
  if (!nonce) {
    return false;
  }

  const client = getRedis();

  if (client) {
    try {
      const key = `nonce:${nonce}`;
      // 使用 SETNX（SET if Not eXists）原子操作
      const result = await client.set(key, "1", { ex: ttlSeconds, nx: true });
      // 如果 result 為 "OK"，表示 nonce 不存在且已設定
      return result === "OK";
    } catch (error) {
      console.error("[WebhookValidator] Redis nonce check error:", error);
      // Redis 錯誤時，fallback 到記憶體快取
    }
  }

  // 記憶體快取 fallback
  return checkAndRecordNonceInMemory(nonce, ttlSeconds);
}

/**
 * 同步版本的 nonce 檢查（用於不支援 async 的情境）
 * 僅使用記憶體快取
 *
 * @param nonce - 要檢查的 nonce
 * @param ttlSeconds - nonce 有效期 (秒)
 * @returns nonce 是否有效
 */
export function checkAndRecordNonceSync(
  nonce: string,
  ttlSeconds: number = 300,
): boolean {
  if (!nonce) {
    return false;
  }
  return checkAndRecordNonceInMemory(nonce, ttlSeconds);
}

/**
 * 使用記憶體快取檢查 nonce
 */
function checkAndRecordNonceInMemory(
  nonce: string,
  ttlSeconds: number,
): boolean {
  const now = Date.now();

  if (memoryNonceCache.has(nonce)) {
    return false;
  }

  memoryNonceCache.set(nonce, now + ttlSeconds * 1000);
  cleanupExpiredNonces();

  return true;
}

/**
 * 清理過期的 nonce（記憶體快取）
 */
function cleanupExpiredNonces(): void {
  const now = Date.now();

  for (const [nonce, expiry] of memoryNonceCache.entries()) {
    if (expiry < now) {
      memoryNonceCache.delete(nonce);
    }
  }
}

/**
 * 驗證 IP 白名單
 *
 * @param ip - 請求來源 IP
 * @param allowedIps - 允許的 IP 清單 (支援 CIDR 格式)
 * @returns IP 是否在白名單中
 */
export function verifyIpWhitelist(ip: string, allowedIps: string[]): boolean {
  if (!ip || !allowedIps || allowedIps.length === 0) {
    return false;
  }

  return allowedIps.some((allowedIp) => {
    if (allowedIp.includes("/")) {
      return isIpInCidr(ip, allowedIp);
    }
    return ip === allowedIp;
  });
}

/**
 * 檢查 IP 是否在 CIDR 範圍內
 *
 * @param ip - 要檢查的 IP
 * @param cidr - CIDR 格式的網段 (例如 192.168.1.0/24)
 * @returns IP 是否在範圍內
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = -1 << (32 - parseInt(bits, 10));

  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);

  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * 將 IP 地址轉換為整數
 */
function ipToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
}
