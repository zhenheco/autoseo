import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ParallelOrchestrator } from '@/lib/agents/orchestrator';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { articleJobId } = await request.json();

    if (!articleJobId) {
      return NextResponse.json(
        { error: 'Article job ID is required' },
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

    const { data: job, error: jobError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', articleJobId)
      .eq('user_id', user.id)
      .single();

    if (!job || jobError) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Job already completed',
        articleJobId,
      });
    }

    if (job.status === 'failed') {
      return NextResponse.json(
        { error: 'Job已失敗，無法繼續' },
        { status: 400 }
      );
    }

    const metadata = job.metadata as Record<string, unknown>;
    const orchestrator = new ParallelOrchestrator();

    try {
      await orchestrator.execute({
        articleJobId: job.id,
        companyId: job.company_id,
        websiteId: job.website_id,
        title: (metadata?.title as string) || job.keywords?.[0] || 'Untitled',
        targetLanguage: metadata?.targetLanguage as string,
        wordCount: typeof metadata?.wordCount === 'string' ? parseInt(metadata.wordCount) : metadata?.wordCount as number,
        imageCount: typeof metadata?.imageCount === 'string' ? parseInt(metadata.imageCount) : metadata?.imageCount as number,
      });

      return NextResponse.json({
        success: true,
        articleJobId,
        message: 'Article generation continued successfully',
      });
    } catch (error) {
      console.error('Article continuation error:', error);
      return NextResponse.json({
        success: false,
        articleJobId,
        error: 'Article generation continuation failed',
        message: (error as Error).message,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Continue article error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
