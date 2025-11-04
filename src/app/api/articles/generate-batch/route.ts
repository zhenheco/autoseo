import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ParallelOrchestrator } from '@/lib/agents/orchestrator';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
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

    const jobIds: string[] = [];
    const failedKeywords: string[] = [];
    const orchestrator = new ParallelOrchestrator();

    for (const keyword of keywords) {
      const articleJobId = uuidv4();

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
            batchIndex: keywords.indexOf(keyword),
            totalBatch: keywords.length,
          },
        });

      if (jobError) {
        console.error('Failed to create article job:', jobError);
        failedKeywords.push(keyword);
        continue;
      }

      jobIds.push(articleJobId);

      orchestrator.execute({
        articleJobId,
        companyId: membership.company_id,
        websiteId,
        keyword,
      }).catch((error) => {
        console.error(`Article generation error for ${keyword}:`, error);
      });
    }

    return NextResponse.json({
      success: true,
      jobIds,
      totalJobs: jobIds.length,
      failedJobs: failedKeywords.length,
      failedKeywords,
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
