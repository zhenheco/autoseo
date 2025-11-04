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
          website_name: '',
          wordpress_url: '',
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

      // 創建對應的 agent_configs
      const { error: agentConfigError } = await supabase
        .from('agent_configs')
        .insert({
          website_id: newWebsite.id,
          research_model: 'deepseek-reasoner',
          complex_processing_model: 'deepseek-reasoner',
          simple_processing_model: 'deepseek-chat',
          image_model: 'gpt-image-1-mini',
          research_temperature: 0.7,
          research_max_tokens: 4000,
          image_size: '1024x1024',
          image_count: 3,
          meta_enabled: true,
        });

      if (agentConfigError) {
        console.error('Failed to create agent config:', agentConfigError);
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

    const prompt = `請根據關鍵字「${keyword}」，生成 10 個帶有數字的吸引人標題。

要求：
- 每個標題都要包含數字（例如：5個、10種、3步驟）
- 標題要吸引人，讓人想點擊
- 每行一個標題
- 不要加編號，直接列出標題

範例格式：
5個關於SEO的實用技巧
10種提升網站流量的方法
3個步驟讓你的內容更吸引人`;

    const response = await router.complete({
      model,
      apiProvider: 'deepseek',
      prompt,
      temperature: 0.9,
      maxTokens: 1000,
    });

    const titles = response.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.match(/^(標題|範例|格式|要求|例如)/))
      .slice(0, 10);

    if (titles.length === 0) {
      console.error('No valid titles generated:', response.content);
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
