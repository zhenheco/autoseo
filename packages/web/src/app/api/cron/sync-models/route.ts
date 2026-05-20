import { NextResponse } from "next/server";
import { ModelSyncService } from "@/lib/model-sync/model-sync-service";
import { withRouteAuth } from "@/lib/api/route-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withRouteAuth("cron", async () => {
  try {
    const syncService = new ModelSyncService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.OPENAI_API_KEY!,
    );

    const results = await syncService.syncAllProviders();
    const deprecatedCount = await syncService.markDeprecatedModels();

    const totalNew = results.reduce((sum, r) => sum + r.newModels, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updatedModels, 0);
    const allErrors = results.flatMap((r) => r.errors);

    console.log("Model sync completed:", {
      newModels: totalNew,
      updatedModels: totalUpdated,
      deprecatedModels: deprecatedCount,
      errors: allErrors.length,
    });

    return NextResponse.json({
      success: true,
      summary: {
        newModels: totalNew,
        updatedModels: totalUpdated,
        deprecatedModels: deprecatedCount,
        errors: allErrors.length,
      },
      details: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Model sync failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
});
