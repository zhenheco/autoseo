import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { UpdateAgentConfigRequest, UpdateAgentConfigResponse } from '@/types/ai-models';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: websiteId } = await params;

    const { data: agentConfig, error } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('website_id', websiteId)
      .single();

    if (error) {
      console.error('[Agent Config API] Error:', error);
      return NextResponse.json(
        { error: 'Query failed', details: error.message },
        { status: 500 }
      );
    }

    if (!agentConfig) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      config: agentConfig,
    });
  } catch (error) {
    console.error('[Agent Config API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: websiteId } = await params;
    const body: UpdateAgentConfigRequest = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.complex_processing_model !== undefined) {
      updates.complex_processing_model = body.complex_processing_model;
    }
    if (body.simple_processing_model !== undefined) {
      updates.simple_processing_model = body.simple_processing_model;
    }
    if (body.image_model !== undefined) {
      updates.image_model = body.image_model;
    }
    if (body.research_model !== undefined) {
      updates.research_model = body.research_model;
    }
    if (body.meta_model !== undefined) {
      updates.meta_model = body.meta_model;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedConfig, error } = await supabase
      .from('agent_configs')
      .update(updates)
      .eq('website_id', websiteId)
      .select('*')
      .single();

    if (error) {
      console.error('[Agent Config API] Update failed:', error);
      return NextResponse.json(
        { error: 'Update failed', details: error.message },
        { status: 500 }
      );
    }

    const response: UpdateAgentConfigResponse = {
      success: true,
      config: updatedConfig,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Agent Config API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
