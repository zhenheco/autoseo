import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ParallelOrchestrator } from '@/lib/agents/orchestrator';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { keyword, title, mode } = await request.json();

    const articleTitle = title || keyword;

    if (!articleTitle || typeof articleTitle !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
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

    const articleJobId = uuidv4();

    const { error: jobError } = await supabase
      .from('article_jobs')
      .insert({
        id: articleJobId,
        job_id: articleJobId,
        company_id: membership.company_id,
        website_id: websiteId,
        user_id: user.id,
        keywords: [articleTitle],
        status: 'pending',
        metadata: {
          mode: mode || 'single',
          title: articleTitle,
        },
      });

    if (jobError) {
      console.error('Failed to create article job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create article job' },
        { status: 500 }
      );
    }

    const orchestrator = new ParallelOrchestrator();

    orchestrator.execute({
      articleJobId,
      companyId: membership.company_id,
      websiteId,
      title: articleTitle,
    }).catch((error) => {
      console.error('Article generation error:', error);
    });

    return NextResponse.json({
      success: true,
      articleJobId,
      message: 'Article generation started',
    });
  } catch (error) {
    console.error('Generate article error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
