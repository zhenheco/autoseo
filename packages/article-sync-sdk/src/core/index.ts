/**
 * @1wayseo/article-sync-sdk - Core
 */

// Client
export { SyncClient, createSyncClient } from "./client";

// Webhook Handler
export {
  WebhookHandler,
  createWebhookHandler,
  verifyWebhookSignature,
} from "./webhook-handler";

// Types
export type {
  // Article types
  SyncedArticle,
  SyncedArticleListItem,
  SyncedTranslation,
  // Webhook types
  WebhookEvent,
  WebhookPayload,
  WebhookArticleData,
  WebhookHandlerResult,
  // Client types
  SyncClientConfig,
  GetArticlesOptions,
  GetArticlesResponse,
  GetArticleResponse,
  // Handler types
  WebhookHandlerConfig,
  SignatureVerificationResult,
  // React types
  UseArticlesOptions,
  UseArticlesResult,
  UseArticleOptions,
  UseArticleResult,
  // Database types
  SyncedArticlesTable,
} from "./types";
