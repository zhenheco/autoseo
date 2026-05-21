/**
 * POST /api/payment/gateway-webhook
 *
 * Legacy payment webhooks are disabled after provider removal.
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-gateway-webhook");

export async function POST(request: NextRequest) {
  logger.info("收到請求");

  try {
    await request.text();
    return NextResponse.json(
      {
        received: false,
        error: "Legacy payment webhooks are disabled",
        code: "PAYMENTS_DISABLED",
      },
      { status: 410 },
    );
  } catch (error) {
    logger.error("未預期錯誤", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: "內部錯誤" }, { status: 500 });
  }
}
