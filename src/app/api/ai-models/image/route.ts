import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc('get_active_image_models');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const groupedByProvider = data?.reduce((acc: any, model: any) => {
      const provider = model.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push({
        id: model.id,
        modelId: model.model_id,
        modelName: model.model_name,
        description: model.description,
        capabilities: model.capabilities,
        pricing: model.pricing,
        imageSizes: model.image_sizes,
        imageQualityOptions: model.image_quality_options,
        tags: model.tags,
      });
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      models: data,
      groupedByProvider,
      count: data?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
