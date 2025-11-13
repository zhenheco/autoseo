#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';
import type { Database } from '../src/types/database.types';

async function main() {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('[Process Jobs] 🔍 查詢待處理任務...');

  // 查詢待處理任務：
  // 1. status 為 pending 或 processing
  // 2. started_at 為 null（未開始）或超過 3 分鐘（卡住的任務）
  const { data: jobs, error } = await supabase
    .from('article_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .or(`started_at.is.null,started_at.lt.${new Date(Date.now() - 3 * 60 * 1000).toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(10); // 最多同時處理 10 個任務

  if (error) {
    console.error('[Process Jobs] ❌ 查詢失敗:', error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Process Jobs] ✅ 沒有待處理任務');
    return;
  }

  console.log(`[Process Jobs] 🔄 發現 ${jobs.length} 個任務`);
  console.log(`[Process Jobs] ⚡ 使用並行處理模式`);

  // 並行處理所有任務
  const processPromises = jobs.map(async (job) => {
    console.log(`[Process Jobs] 🔒 嘗試鎖定任務 ${job.id}`);

    const { data: locked, error: lockError } = await supabase
      .from('article_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id)
      .select();

    if (lockError) {
      console.log(`[Process Jobs] ❌ 鎖定任務失敗 ${job.id}: ${lockError.message}`);
      return { success: false, jobId: job.id };
    }

    if (!locked || locked.length === 0) {
      console.log(`[Process Jobs] ⏭️  任務 ${job.id} 無法鎖定（可能已被其他程序處理）`);
      return { success: false, jobId: job.id };
    }

    console.log(`[Process Jobs] ✅ 成功鎖定任務 ${job.id}`);

    try {
      const orchestrator = new ParallelOrchestrator(supabase);
      const metadata = job.metadata as Record<string, unknown> | null;
      const title = (metadata?.title as string) || job.keywords?.[0] || 'Untitled';

      console.log(`[Process Jobs] 🚀 開始處理任務 ${job.id} - ${title}`);

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
      return { success: true, jobId: job.id };
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

      return { success: false, jobId: job.id };
    }
  });

  // 等待所有任務完成
  const results = await Promise.all(processPromises);
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  console.log(`[Process Jobs] 📊 處理結果：${successCount} 成功，${failedCount} 失敗`);
  results.forEach(result => {
    console.log(`  - ${result.jobId}: ${result.success ? '✅' : '❌'}`);
  });

  console.log('[Process Jobs] 🎉 所有任務處理完成');
}

main().catch((err) => {
  console.error('[Process Jobs] ❌ Fatal error:', err);
  process.exit(1);
});
