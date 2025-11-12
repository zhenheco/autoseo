import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ParallelOrchestrator } from '@/lib/agents/orchestrator';
import { v4 as uuidv4 } from 'uuid';

// Vercel 無伺服器函數最大執行時間：5 分鐘（Hobby 計劃上限，批次生成）
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { keywords, items, options } = await request.json();

    const generationItems = items || keywords?.map((kw: string) => ({ keyword: kw, title: kw })) || [];

    if (!generationItems || generationItems.length === 0) {
      return NextResponse.json(
        { error: 'Items or keywords array is required' },
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

      const { error: agentConfigError } = await supabase
        .from('agent_configs')
        .insert({
          website_id: newWebsite.id,
          research_model: 'deepseek-reasoner',
          complex_processing_model: 'deepseek-reasoner',
          simple_processing_model: 'deepseek-chat',
          image_model: 'gpt-image-1-mini',
          research_temperature: 0.7,
          research_max_tokens: 64000,
          strategy_temperature: 0.7,
          strategy_max_tokens: 64000,
          writing_temperature: 0.7,
          writing_max_tokens: 64000,
          image_size: '1024x1024',
          image_count: 3,
          meta_enabled: true,
          meta_temperature: 0.7,
          meta_max_tokens: 64000,
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

    const jobIds: string[] = [];
    const failedItems: string[] = [];
    const orchestrator = new ParallelOrchestrator();

    for (const item of generationItems) {
      const articleJobId = uuidv4();
      const keyword = item.keyword || item.title;
      const title = item.title || item.keyword;

      const { error: jobError } = await supabase
        .from('article_jobs')
        .insert({
          id: articleJobId,
          job_id: articleJobId,
          company_id: membership.company_id,
          website_id: websiteId,
          user_id: user.id,
          keywords: [keyword],
          status: 'pending',
          metadata: {
            mode: 'batch',
            title,
            batchIndex: generationItems.indexOf(item),
            totalBatch: generationItems.length,
            targetLanguage: options?.targetLanguage || 'zh-TW',
            wordCount: options?.wordCount || '1500',
            imageCount: options?.imageCount || '3',
          },
        });

      if (jobError) {
        console.error('Failed to create article job:', jobError);
        failedItems.push(title);
        continue;
      }

      jobIds.push(articleJobId);

      orchestrator.execute({
        articleJobId,
        companyId: membership.company_id,
        websiteId,
        title: title,
        targetLanguage: options?.targetLanguage,
        wordCount: parseInt(options?.wordCount || '1500'),
        imageCount: parseInt(options?.imageCount || '3'),
      }).catch((error) => {
        console.error(`Article generation error for ${title}:`, error);
      });
    }

    return NextResponse.json({
      success: true,
      jobIds,
      totalJobs: jobIds.length,
      failedJobs: failedItems.length,
      failedItems,
      message: 'Batch article generation started',
    });
  } catch (error) {
    console.error('Batch generate error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
