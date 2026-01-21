/**
 * @1wayseo/article-sync-sdk
 *
 * SDK for syncing articles from 1waySEO to external projects
 *
 * @example Basic usage
 * ```typescript
 * import { createSyncClient, createWebhookHandler } from '@1wayseo/article-sync-sdk';
 *
 * // Query articles
 * const client = createSyncClient({
 *   supabaseUrl: process.env.SUPABASE_URL!,
 *   supabaseKey: process.env.SUPABASE_ANON_KEY!,
 * });
 * const { articles } = await client.getArticles({ limit: 10 });
 *
 * // Handle webhooks
 * const handler = createWebhookHandler({
 *   supabaseUrl: process.env.SUPABASE_URL!,
 *   supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
 *   webhookSecret: process.env.ONEWAYSEO_WEBHOOK_SECRET!,
 * });
 * ```
 *
 * @example React hooks
 * ```tsx
 * import { useArticles, useArticle } from '@1wayseo/article-sync-sdk/react';
 *
 * function ArticleList() {
 *   const { articles, isLoading } = useArticles(config);
 *   // ...
 * }
 * ```
 *
 * @example Next.js API route
 * ```typescript
 * // app/api/webhooks/1wayseo/route.ts
 * import { createWebhookHandler } from '@1wayseo/article-sync-sdk/nextjs';
 *
 * export const POST = createWebhookHandler({
 *   supabaseUrl: process.env.SUPABASE_URL!,
 *   supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
 *   webhookSecret: process.env.ONEWAYSEO_WEBHOOK_SECRET!,
 * });
 * ```
 */

// Re-export everything from core
export * from "./core";
