/**
 * Next.js API Route Handler
 * 用於處理來自 1waySEO 的 Webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { WebhookHandler } from "../core/webhook-handler";
import type { WebhookHandlerConfig, WebhookHandlerResult } from "../core/types";

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
export function createNextjsWebhookHandler(config: WebhookHandlerConfig) {
  const handler = new WebhookHandler(config);

  return async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      // 取得 headers
      const signature = request.headers.get(WebhookHandler.SIGNATURE_HEADER);
      const timestamp = request.headers.get(WebhookHandler.TIMESTAMP_HEADER);

      // 取得 body
      const body = await request.text();

      // 處理 webhook
      const result: WebhookHandlerResult = await handler.handleWebhook(
        body,
        signature,
        timestamp
      );

      if (result.success) {
        return NextResponse.json(
          {
            success: true,
            message: result.message,
            article_id: result.article_id,
            received_at: new Date().toISOString(),
          },
          { status: 200 }
        );
      } else {
        // 簽章錯誤返回 401
        const isAuthError =
          result.error?.includes("signature") ||
          result.error?.includes("timestamp");

        return NextResponse.json(
          {
            success: false,
            error: result.error,
          },
          { status: isAuthError ? 401 : 400 }
        );
      }
    } catch (error) {
      console.error("[1waySEO Webhook] 處理錯誤:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
        },
        { status: 500 }
      );
    }
  };
}

// 別名，更簡潔的命名
export { createNextjsWebhookHandler as createWebhookHandler };
