import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { GetModelsResponse } from '@/types/ai-models';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const type = searchParams.get('type');
  const provider = searchParams.get('provider');
  const processing_tier = searchParams.get('processing_tier');
  const api_provider = searchParams.get('api_provider');
  const is_active = searchParams.get('is_active');

  try {
    let query = supabase
      .from('ai_models')
      .select('*')
      .eq('is_active', is_active === 'false' ? false : true)
      .order('sort_order');

    if (type) {
      query = query.eq('model_type', type);
    }

    if (provider) {
      query = query.eq('provider', provider);
    }

    if (processing_tier) {
      query = query.or(`processing_tier.eq.${processing_tier},processing_tier.eq.both`);
    }

    if (api_provider) {
      query = query.eq('api_provider', api_provider);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AI Models API] 查詢失敗:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: GetModelsResponse = {
      models: data || [],
      total: data?.length || 0,
    };

    return NextResponse.json({
      success: true,
      ...response,
      count: response.total,
    });
  } catch (error: unknown) {
    console.error('[AI Models API] 未預期的錯誤:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('ai_models')
      .insert([body])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      model: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ai_models')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      model: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
