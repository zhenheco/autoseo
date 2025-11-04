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

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, website_configs(id)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership || !membership.company_id) {
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

    const jobIds: string[] = [];
    const orchestrator = new ParallelOrchestrator();

    for (const keyword of keywords) {
      const articleJobId = uuidv4();
      jobIds.push(articleJobId);

      const { error: jobError } = await supabase
        .from('article_jobs')
        .insert({
          id: articleJobId,
          website_id: websiteId,
          keywords: keyword,
          status: 'pending',
          metadata: {
            mode: 'batch',
            batchIndex: keywords.indexOf(keyword),
            totalBatch: keywords.length,
          },
        });

      if (jobError) {
        console.error('Failed to create article job:', jobError);
        continue;
      }

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
