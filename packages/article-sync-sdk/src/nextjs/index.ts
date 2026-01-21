/**
 * @1wayseo/article-sync-sdk/nextjs
 * Next.js 整合模組
 */

export {
  createNextjsWebhookHandler,
  createWebhookHandler,
} from "./api-handler";

// Re-export types for convenience
export type {
  WebhookHandlerConfig,
  WebhookHandlerResult,
  WebhookPayload,
  WebhookEvent,
} from "../core/types";
