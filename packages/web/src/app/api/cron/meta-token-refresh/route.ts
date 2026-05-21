import { NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { refreshExpiringMetaTokens } from "@/lib/social/meta/refresh";

export const GET = withRouteAuth("cron", async () => {
  const result = await refreshExpiringMetaTokens();

  return NextResponse.json({
    success: true,
    result,
    completedAt: new Date().toISOString(),
  });
});
