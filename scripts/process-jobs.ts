#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';
import type { Database } from '../src/types/database.types';

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Process Jobs] ❌ Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient<Database>(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('[Process Jobs] 🔍 查詢待處理任務...');

  const { data: jobs, error } = await supabase
    .from('article_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .or(`started_at.is.null,started_at.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    console.error('[Process Jobs] ❌ 查詢失敗:', error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Process Jobs] ✅ 沒有待處理任務');
    return;
  }

  console.log(`[Process Jobs] 🔄 發現 ${jobs.length} 個任務`);

  for (const job of jobs) {
    console.log(`[Process Jobs] 🔒 鎖定任務 ${job.id}`);

    const { data: locked } = await supabase
      .from('article_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id)
      .in('status', ['pending', 'processing'])
      .or(`started_at.is.null,started_at.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()}`)
      .select();

    if (!locked || locked.length === 0) {
      console.log(`[Process Jobs] ⏭️  任務 ${job.id} 已被鎖定，跳過`);
      continue;
    }

    try {
      const orchestrator = new ParallelOrchestrator(supabase);
      const metadata = job.metadata as Record<string, unknown> | null;
      const title = (metadata?.title as string) || job.keywords?.[0] || 'Untitled';

      console.log(`[Process Jobs] 🚀 開始處理任務 ${job.id}`);

      await orchestrator.execute({
        articleJobId: job.id,
        companyId: job.company_id,
        websiteId: job.website_id,
        title: title,
        targetLanguage: metadata?.targetLanguage as string | undefined,
        wordCount: typeof metadata?.wordCount === 'string'
          ? parseInt(metadata.wordCount)
          : (metadata?.wordCount as number | undefined),
        imageCount: typeof metadata?.imageCount === 'string'
          ? parseInt(metadata.imageCount)
          : (metadata?.imageCount as number | undefined),
      });

      console.log(`[Process Jobs] ✅ 任務 ${job.id} 處理成功`);
    } catch (err) {
      console.error(`[Process Jobs] ❌ 任務 ${job.id} 失敗:`, err);

      await supabase
        .from('article_jobs')
        .update({
          status: 'failed',
          metadata: {
            ...(job.metadata as Record<string, unknown> || {}),
            error: err instanceof Error ? err.message : String(err),
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', job.id);
    }
  }

  console.log('[Process Jobs] 🎉 所有任務處理完成');
}

main().catch((err) => {
  console.error('[Process Jobs] ❌ Fatal error:', err);
  process.exit(1);
});
