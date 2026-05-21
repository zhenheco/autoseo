import { NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { processDueDunningSchedules } from "@/lib/payments/dunning/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = withRouteAuth("cron", async () => {
  try {
    const result = await processDueDunningSchedules();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[dunning-cron] processing failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
});
