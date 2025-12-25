/**
 * 錯誤通知服務
 * 處理 CRITICAL 錯誤的郵件通知，包含去重和限流機制
 */

import { createHash } from "crypto";
import { cacheGet, cacheSet } from "@/lib/cache/redis-cache";
import { sendErrorAlertEmail } from "@/lib/email";

/**
 * 可通知的錯誤類型
 */
export interface NotifiableError {
  id: string;
  category: string;
  severity: string;
  message: string;
  stack?: string;
  context: {
    source: "agent" | "api" | "cron";
    agentName?: string;
    endpoint?: string;
    articleJobId?: string;
    companyId?: string;
  };
  timestamp: string;
}

/** Redis 快取鍵前綴 */
const CACHE_KEYS = {
  /** 錯誤通知去重 - 15 分鐘 TTL */
  DEDUP: "notify:error:dedup",
  /** 錯誤通知限流計數器 - 1 小時 TTL */
  RATE_LIMIT: "notify:error:rate",
} as const;

/** 配置常數 */
const CONFIG = {
  /** 去重窗口（秒） - 15 分鐘內相同錯誤只發一次 */
  DEDUP_TTL_SECONDS: 900,
  /** 限流週期（秒） - 1 小時 */
  RATE_LIMIT_TTL_SECONDS: 3600,
  /** 每小時最大通知數 */
  MAX_NOTIFICATIONS_PER_HOUR: 10,
} as const;

/**
 * 錯誤通知服務（Singleton）
 * 負責處理 CRITICAL 錯誤的郵件通知
 */
export class ErrorNotificationService {
  private static instance: ErrorNotificationService | null = null;

  private constructor() {}

  /**
   * 取得服務實例
   */
  static getInstance(): ErrorNotificationService {
    if (!ErrorNotificationService.instance) {
      ErrorNotificationService.instance = new ErrorNotificationService();
    }
    return ErrorNotificationService.instance;
  }

  /**
   * 發送錯誤通知（主要入口）
   * 只處理 CRITICAL 嚴重性的錯誤
   *
   * @param error - 錯誤資訊
   */
  async notify(error: NotifiableError): Promise<void> {
    // 只處理 CRITICAL 錯誤
    if (error.severity.toLowerCase() !== "critical") {
      console.log(
        `[ErrorNotificationService] 跳過非 CRITICAL 錯誤: ${error.severity}`,
      );
      return;
    }

    try {
      // 產生錯誤指紋
      const fingerprint = this.generateFingerprint(error);

      // 檢查是否為重複錯誤（15 分鐘內）
      const isDuplicate = await this.checkDuplicate(fingerprint);
      if (isDuplicate) {
        console.log(
          `[ErrorNotificationService] 跳過重複錯誤: ${fingerprint.substring(0, 8)}...`,
        );
        return;
      }

      // 檢查是否超過限流
      const isLimited = await this.checkRateLimit();
      if (isLimited) {
        console.warn(
          `[ErrorNotificationService] 已達到每小時通知上限 (${CONFIG.MAX_NOTIFICATIONS_PER_HOUR})，跳過通知`,
        );
        return;
      }

      // 發送通知郵件
      await this.sendNotification(error);

      // 記錄已發送（用於去重）
      await this.recordNotification(fingerprint);

      // 增加限流計數器
      await this.incrementRateLimit();

      console.log(
        `[ErrorNotificationService] 已發送 CRITICAL 錯誤通知: ${error.id}`,
      );
    } catch (err) {
      // 通知服務本身的錯誤不應該影響主流程
      console.error("[ErrorNotificationService] 發送通知時發生錯誤:", err);
    }
  }

  /**
   * 產生錯誤指紋（用於去重）
   * 正規化錯誤訊息，移除變動部分（UUID、時間戳、數字等）
   */
  private generateFingerprint(error: NotifiableError): string {
    // 正規化錯誤訊息
    const normalizedMessage = error.message
      // 移除 UUID
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "<UUID>",
      )
      // 移除 ISO 時間戳
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<TIMESTAMP>")
      // 移除純數字
      .replace(/\d+/g, "<NUM>")
      // 只取前 100 字元
      .substring(0, 100);

    // 組合指紋要素
    const parts = [
      error.category,
      error.context.source,
      error.context.agentName || "none",
      error.context.endpoint || "none",
      normalizedMessage,
    ];

    // 產生 MD5 雜湊
    return createHash("md5")
      .update(parts.join("|"))
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * 檢查是否為重複錯誤
   */
  private async checkDuplicate(fingerprint: string): Promise<boolean> {
    const key = `${CACHE_KEYS.DEDUP}:${fingerprint}`;
    const existing = await cacheGet<boolean>(key);
    return existing === true;
  }

  /**
   * 記錄已發送的通知（用於去重）
   */
  private async recordNotification(fingerprint: string): Promise<void> {
    const key = `${CACHE_KEYS.DEDUP}:${fingerprint}`;
    await cacheSet(key, true, CONFIG.DEDUP_TTL_SECONDS);
  }

  /**
   * 檢查是否超過限流
   */
  private async checkRateLimit(): Promise<boolean> {
    const key = this.getRateLimitKey();
    const count = await cacheGet<number>(key);
    return (count ?? 0) >= CONFIG.MAX_NOTIFICATIONS_PER_HOUR;
  }

  /**
   * 增加限流計數器
   */
  private async incrementRateLimit(): Promise<void> {
    const key = this.getRateLimitKey();
    const currentCount = (await cacheGet<number>(key)) ?? 0;
    await cacheSet(key, currentCount + 1, CONFIG.RATE_LIMIT_TTL_SECONDS);
  }

  /**
   * 取得限流計數器的 key（每小時重置）
   */
  private getRateLimitKey(): string {
    const hour = new Date().getUTCHours();
    const date = new Date().toISOString().split("T")[0];
    return `${CACHE_KEYS.RATE_LIMIT}:${date}:${hour}`;
  }

  /**
   * 發送通知郵件
   */
  private async sendNotification(error: NotifiableError): Promise<void> {
    const success = await sendErrorAlertEmail({
      error: {
        id: error.id,
        severity: error.severity,
        category: error.category,
        message: error.message,
        stack: error.stack,
        source: error.context.source,
        agentName: error.context.agentName,
        endpoint: error.context.endpoint,
        articleJobId: error.context.articleJobId,
        companyId: error.context.companyId,
        timestamp: error.timestamp,
      },
    });

    if (!success) {
      console.error("[ErrorNotificationService] 郵件發送失敗");
    }
  }
}

/**
 * 便利函數：直接發送錯誤通知
 * 用於不需要存取 ErrorNotificationService 實例的場景
 */
export async function notifyError(error: NotifiableError): Promise<void> {
  return ErrorNotificationService.getInstance().notify(error);
}
