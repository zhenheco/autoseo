import { NextRequest, NextResponse } from 'next/server';
import { getAPIRouter } from '@/lib/ai/api-router';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: 'Keyword is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, website_configs(id)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'No active company membership' },
        { status: 403 }
      );
    }

    const websiteId = (membership.website_configs as any)?.[0]?.id;

    if (!websiteId) {
      return NextResponse.json(
        { error: 'No website configured' },
        { status: 404 }
      );
    }

    const { data: agentConfig } = await supabase
      .from('agent_configs')
      .select('simple_processing_model')
      .eq('website_id', websiteId)
      .single();

    const model = agentConfig?.simple_processing_model || 'deepseek-chat';

    const router = getAPIRouter();

    const prompt = `Generate 10 creative and SEO-optimized article titles for the keyword: "${keyword}".

Requirements:
- Each title should be engaging and click-worthy
- Include the keyword naturally
- Vary the title formats (How-to, List, Question, etc.)
- Make them suitable for blog articles
- Return ONLY a JSON array of 10 strings, no other text

Example format:
["Title 1", "Title 2", "Title 3", ...]`;

    const response = await router.complete({
      model,
      apiProvider: 'deepseek',
      prompt,
      temperature: 0.9,
      maxTokens: 1000,
      responseFormat: 'json',
    });

    let titles: string[] = [];
    try {
      titles = JSON.parse(response.content);
      if (!Array.isArray(titles) || titles.length === 0) {
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('Failed to parse titles:', parseError);
      return NextResponse.json(
        { error: 'Failed to generate titles' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      titles: titles.slice(0, 10),
      keyword,
    });
  } catch (error) {
    console.error('Generate titles error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
