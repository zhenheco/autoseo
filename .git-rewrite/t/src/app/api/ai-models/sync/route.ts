import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { fetchOpenRouterModels, normalizeOpenRouterModel } from '@/lib/openrouter';

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const models = await fetchOpenRouterModels();

    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const model of models) {
      try {
        const normalizedModel = normalizeOpenRouterModel(model);

        const { error } = await supabase
          .from('ai_models')
          .upsert(normalizedModel, { onConflict: 'model_id' });

        if (error) {
          console.error(`Failed to sync model ${model.id}:`, error);
          errors.push(`${model.id}: ${error.message}`);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (err: any) {
        console.error(`Error processing model ${model.id}:`, err);
        errors.push(`${model.id}: ${err.message}`);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      errors: errorCount,
      total: models.length,
      message: `同步完成: ${syncedCount} 個模型成功, ${errorCount} 個失敗`,
      errorDetails: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: '使用 POST 方法觸發模型同步',
    usage: 'POST /api/ai-models/sync',
    description: '從 OpenRouter 同步所有可用的 AI 模型',
  });
}
