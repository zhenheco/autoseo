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

    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership || membershipError) {
      console.error('Membership error:', membershipError);
      return NextResponse.json(
        { error: 'No active company membership' },
        { status: 403 }
      );
    }

    const websiteQuery = await supabase
      .from('website_configs')
      .select('id')
      .eq('company_id', membership.company_id)
      .limit(1);

    let websites = websiteQuery.data;
    const websiteError = websiteQuery.error;

    if ((!websites || websites.length === 0) && !websiteError) {
      console.log('Creating default website config for company:', membership.company_id);
      const { data: newWebsite, error: createError } = await supabase
        .from('website_configs')
        .insert({
          company_id: membership.company_id,
        })
        .select('id')
        .single();

      if (createError || !newWebsite) {
        console.error('Failed to create website config:', createError);
        return NextResponse.json(
          { error: 'Failed to create website configuration' },
          { status: 500 }
        );
      }

      websites = [newWebsite];
    }

    if (!websites || websites.length === 0) {
      console.error('Website error:', websiteError);
      return NextResponse.json(
        { error: 'No website configured' },
        { status: 404 }
      );
    }

    const websiteId = websites[0].id;

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
