import { NextRequest, NextResponse } from 'next/server';
import { getAPIRouter } from '@/lib/ai/api-router';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { keyword, targetLanguage = 'zh-TW' } = await request.json();

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
        return NextResponse.json(
          { error: 'Failed to create agent configuration', details: agentConfigError.message },
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

    // Language mapping
    const languageMap: Record<string, { name: string; example: string }> = {
      'zh-TW': { name: 'Traditional Chinese (繁體中文)', example: '5個關於SEO的實用技巧' },
      'zh-CN': { name: 'Simplified Chinese (简体中文)', example: '5个关于SEO的实用技巧' },
      'en': { name: 'English', example: '5 Proven SEO Strategies That Work' },
      'ja': { name: 'Japanese (日本語)', example: 'SEOに関する5つの実用的なヒント' },
      'ko': { name: 'Korean (한국어)', example: 'SEO에 대한 5가지 실용적인 팁' },
      'es': { name: 'Spanish (Español)', example: '5 Consejos Prácticos sobre SEO' },
      'fr': { name: 'French (Français)', example: '5 Conseils Pratiques sur le SEO' },
      'de': { name: 'German (Deutsch)', example: '5 Praktische SEO-Tipps' },
      'pt': { name: 'Portuguese (Português)', example: '5 Dicas Práticas sobre SEO' },
      'it': { name: 'Italian (Italiano)', example: '5 Consigli Pratici sul SEO' },
      'ru': { name: 'Russian (Русский)', example: '5 практических советов по SEO' },
      'ar': { name: 'Arabic (العربية)', example: '5 نصائح عملية حول تحسين محركات البحث' },
      'th': { name: 'Thai (ไทย)', example: '5 เคล็ดลับ SEO ที่ใช้งานได้จริง' },
      'vi': { name: 'Vietnamese (Tiếng Việt)', example: '5 Mẹo SEO Thực Tế' },
      'id': { name: 'Indonesian (Bahasa Indonesia)', example: '5 Tips SEO yang Praktis' },
    };

    const lang = languageMap[targetLanguage] || languageMap['zh-TW'];

    const prompt = `First, translate the keyword "${keyword}" to ${lang.name} if it's not already in that language.

Then, generate 10 engaging titles with numbers based on the translated keyword.

Requirements:
- Each title MUST include a number (e.g., 5, 10, 3)
- Titles should be click-worthy and engaging
- One title per line
- No numbering prefix, just list the titles directly
- ALL titles MUST be written in ${lang.name}

Example format for ${lang.name}:
${lang.example}

IMPORTANT: Generate ALL 10 titles in ${lang.name} language only.`;

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
