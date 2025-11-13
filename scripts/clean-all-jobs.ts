#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

const supabaseUrl = 'https://vdjzeregvyimgzflfalv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkanplcmVndnlpbWd6ZmxmYWx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxNTY1NywiZXhwIjoyMDc2NzkxNjU3fQ.DSL9Ckh3S0ii5Xv-s0I87XZ0cRHI6_hwJ_s3xE1E-og';

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function cleanAllJobs() {
  console.log('開始清理所有 pending 和 processing 任務...\n');

  // 標記所有 pending 和 processing 任務為 cancelled
  const { data, error } = await supabase
    .from('article_jobs')
    .update({
      status: 'failed',
      metadata: {
        error: '用戶手動取消所有任務',
        cancelled_at: new Date().toISOString(),
      },
    })
    .in('status', ['pending', 'processing'])
    .select('id, metadata');

  if (error) {
    console.error('❌ 清理失敗:', error);
    return;
  }

  console.log(`✅ 成功取消 ${data?.length || 0} 個任務\n`);

  data?.forEach((job, index) => {
    const metadata = job.metadata as any;
    const title = metadata?.title || 'Untitled';
    console.log(`${index + 1}. ${title} (${job.id})`);
  });

  console.log('\n🎉 清理完成！現在可以在前端重新提交新的文章任務。');
}

cleanAllJobs();
