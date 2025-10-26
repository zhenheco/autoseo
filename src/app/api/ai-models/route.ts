import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const type = searchParams.get('type');
  const provider = searchParams.get('provider');

  try {
    let query = supabase
      .from('ai_models')
      .select('*')
      .eq('is_active', true)
      .eq('is_deprecated', false)
      .order('provider')
      .order('model_id');

    if (type) {
      query = query.eq('model_type', type);
    }

    if (provider) {
      query = query.eq('provider', provider);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      models: data,
      count: data?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
