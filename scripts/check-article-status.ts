#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkArticleStatus() {
  console.log('[Check Status] 查詢文章狀態...\n');

  const { data: jobs, error } = await supabase
    .from('article_jobs')
    .select('id, status, metadata, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    console.error('[Check Status] ❌ 查詢失敗:', error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Check Status] ✅ 沒有文章');
    return;
  }

  console.log(`[Check Status] 📊 找到 ${jobs.length} 篇文章\n`);

  const statusCount = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  jobs.forEach((job) => {
    const metadata = job.metadata as Record<string, unknown> | null;
    const title = (metadata?.title as string) || 'Untitled';
    const articleId = (metadata?.article_id as string) || '無';

    statusCount[job.status as keyof typeof statusCount]++;

    const statusEmoji = {
      pending: '⏳',
      processing: '🔄',
      completed: '✅',
      failed: '❌',
    }[job.status] || '❓';

    console.log(`${statusEmoji} [${job.status.toUpperCase()}] ${title}`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Article ID: ${articleId}`);
    console.log(`   建立時間: ${new Date(job.created_at).toLocaleString('zh-TW')}`);

    if (job.completed_at) {
      console.log(`   完成時間: ${new Date(job.completed_at).toLocaleString('zh-TW')}`);
    }

    console.log('');
  });

  console.log('📊 狀態統計:');
  console.log(`   ⏳ Pending: ${statusCount.pending}`);
  console.log(`   🔄 Processing: ${statusCount.processing}`);
  console.log(`   ✅ Completed: ${statusCount.completed}`);
  console.log(`   ❌ Failed: ${statusCount.failed}`);
}

checkArticleStatus().catch(console.error);
