#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetFailedJobs() {
  console.log('[Reset] 查詢失敗的任務...');

  const { data: jobs, error: fetchError } = await supabase
    .from('article_jobs')
    .select('id, metadata')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (fetchError) {
    console.error('[Reset] ❌ 查詢失敗:', fetchError);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Reset] ✅ 沒有失敗的任務');
    return;
  }

  console.log(`[Reset] 🔄 發現 ${jobs.length} 個失敗任務`);

  for (const job of jobs) {
    const title = (job.metadata as any)?.title || 'Untitled';
    console.log(`[Reset] 重置任務: ${job.id} - ${title}`);

    const { error: updateError } = await supabase
      .from('article_jobs')
      .update({
        status: 'pending',
        started_at: null,
        completed_at: null,
        error_message: null,
      })
      .eq('id', job.id);

    if (updateError) {
      console.error(`[Reset] ❌ 重置失敗:`, updateError);
    } else {
      console.log(`[Reset] ✅ 已重置: ${title}`);
    }
  }

  console.log('[Reset] 🎉 所有失敗任務已重置為 pending');
}

resetFailedJobs().catch(console.error);
