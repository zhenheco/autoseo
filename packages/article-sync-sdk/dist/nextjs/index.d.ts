import { NextRequest, NextResponse } from 'next/server';
import { W as WebhookHandlerConfig } from '../types-BUKyMdyc.js';
export { h as WebhookEvent, d as WebhookHandlerResult, i as WebhookPayload } from '../types-BUKyMdyc.js';

/**
 * Next.js API Route Handler
 * 用於處理來自 1waySEO 的 Webhook
 */

/**
 * 建立 Next.js API Route Handler
 *
 * @example
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
declare function createNextjsWebhookHandler(config: WebhookHandlerConfig): (request: NextRequest) => Promise<NextResponse>;

export { WebhookHandlerConfig, createNextjsWebhookHandler, createNextjsWebhookHandler as createWebhookHandler };
