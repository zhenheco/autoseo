/**
 * 文章同步模組
 *
 * 負責將 Z-1wayseo 的文章同步到外部專案（如 onehand）
 *
 * @example
 * ```typescript
 * import { syncArticle, getSyncService } from '@/lib/sync';
 *
 * // 使用便捷函數
 * const result = await syncArticle(article, 'create');
 *
 * // 使用服務實例
 * const service = getSyncService();
 * const result = await service.syncArticle(article, 'create');
 * ```
 */

// 主要服務
export {
  ArticleSyncService,
  getSyncService,
  syncArticle,
} from "./sync-service";

// Webhook 工具
export {
  generateSignature,
  verifySignature,
  sendWebhook,
  sendWebhookBatch,
} from "./webhook-sender";

// 工具函數
export { extractFirstImageUrl, extractImageAlt } from "./utils";

// 類型
export type {
  SyncTarget,
  ArticleSyncLog,
  SyncAction,
  SyncStatus,
  WebhookPayload,
  SyncedArticleData,
  SyncedTranslationData,
  WebhookResponse,
  SyncResult,
  BatchSyncResult,
  SyncServiceConfig,
  WebhookSendOptions,
  WebhookSignature,
} from "./types";
