import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ParallelOrchestrator } from '@/lib/agents/orchestrator';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // TODO: Fix CRON_SECRET mismatch between GitHub Actions and Vercel
    // Temporarily disabled for testing
    // const authHeader = request.headers.get('authorization');
    // const cronSecret = process.env.CRON_SECRET;
    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const supabase = await createClient();

    const { data: jobs, error: queryError } = await supabase
      .from('article_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .or('started_at.is.null,started_at.lt.' + new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(5);

    if (queryError) {
      console.error('[Cron] Query error:', queryError);
      return NextResponse.json({ error: 'Query failed', details: queryError.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No jobs to process',
        processed: 0,
      });
    }

    console.log(`[Cron] 🔄 Found ${jobs.length} jobs to process`);

    const results = [];

    for (const job of jobs) {
      try {
        const updateData: Record<string, unknown> = {
          started_at: new Date().toISOString(),
        };

        if (job.status === 'pending') {
          updateData.status = 'processing';
        }

        const lockUpdate = await supabase
          .from('article_jobs')
          .update(updateData)
          .eq('id', job.id)
          .in('status', ['pending', 'processing'])
          .or('started_at.is.null,started_at.lt.' + new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .select();

        if (!lockUpdate.data || lockUpdate.data.length === 0) {
          console.log(`[Cron] ⏭️  Job ${job.id} already locked, skipping`);
          continue;
        }

        console.log(`[Cron] 🔒 Locked job ${job.id}, status: ${job.status} → ${job.status === 'pending' ? 'processing' : 'processing'}`);

        const orchestrator = new ParallelOrchestrator();

        const metadata = job.metadata as Record<string, unknown>;
        const title = (metadata?.title as string) || job.keywords?.[0] || 'Untitled';

        await orchestrator.execute({
          articleJobId: job.id,
          companyId: job.company_id,
          websiteId: job.website_id,
          title: title,
          targetLanguage: metadata?.targetLanguage as string,
          wordCount: typeof metadata?.wordCount === 'string' ? parseInt(metadata.wordCount) : metadata?.wordCount as number,
          imageCount: typeof metadata?.imageCount === 'string' ? parseInt(metadata.imageCount) : metadata?.imageCount as number,
        });

        results.push({
          jobId: job.id,
          status: 'success',
          phase: metadata?.current_phase,
        });

        console.log(`[Cron] ✅ Job ${job.id} processed successfully`);
      } catch (error) {
        console.error(`[Cron] ❌ Job ${job.id} failed:`, error);

        await supabase
          .from('article_jobs')
          .update({
            status: 'failed',
            metadata: {
              ...job.metadata,
              error: (error as Error).message,
              failed_at: new Date().toISOString(),
            },
          })
          .eq('id', job.id);

        results.push({
          jobId: job.id,
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
