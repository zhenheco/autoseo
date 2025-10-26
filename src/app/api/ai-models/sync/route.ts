import { NextResponse } from 'next/server';
import { ModelSyncService } from '@/lib/model-sync/model-sync-service';

export async function POST(request: Request) {
  try {
    const { provider } = await request.json().catch(() => ({}));

    const syncService = new ModelSyncService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.OPENAI_API_KEY!
    );

    let results;

    if (provider === 'openai') {
      results = [await syncService.syncOpenAI()];
    } else if (provider === 'anthropic') {
      results = [await syncService.syncAnthropic()];
    } else {
      results = await syncService.syncAllProviders();
    }

    const totalNew = results.reduce((sum, r) => sum + r.newModels, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updatedModels, 0);
    const allErrors = results.flatMap((r) => r.errors);

    const deprecatedCount = await syncService.markDeprecatedModels();

    return NextResponse.json({
      success: true,
      summary: {
        newModels: totalNew,
        updatedModels: totalUpdated,
        deprecatedModels: deprecatedCount,
        errors: allErrors.length,
      },
      details: results,
      errors: allErrors,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Use POST to trigger model sync',
    usage: {
      syncAll: 'POST /api/ai-models/sync',
      syncOpenAI: 'POST /api/ai-models/sync { "provider": "openai" }',
      syncAnthropic: 'POST /api/ai-models/sync { "provider": "anthropic" }',
    },
  });
}
