import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ParallelOrchestrator } from '@/lib/agents/orchestrator';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { keyword, title, mode } = await request.json();

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

    const { data: websites, error: websiteError } = await supabase
      .from('website_configs')
      .select('id')
      .eq('company_id', membership.company_id)
      .limit(1);

    if (!websites || websites.length === 0 || websiteError) {
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
        website_id: websiteId,
        keywords: keyword,
        status: 'pending',
        metadata: {
          mode: mode || 'single',
          title: title || null,
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
      keyword,
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
