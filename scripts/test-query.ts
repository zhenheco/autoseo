#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

const supabaseUrl = 'https://vdjzeregvyimgzflfalv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkanplcmVndnlpbWd6ZmxmYWx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxNTY1NywiZXhwIjoyMDc2NzkxNjU3fQ.DSL9Ckh3S0ii5Xv-s0I87XZ0cRHI6_hwJ_s3xE1E-og';

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function testQuery() {
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

  console.log('查詢條件：');
  console.log(`- 3 分鐘前: ${threeMinutesAgo.toISOString()}`);
  console.log('');

  const { data: jobs, error } = await supabase
    .from('article_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .or(`started_at.is.null,started_at.lt.${threeMinutesAgo.toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`查詢結果：找到 ${jobs?.length || 0} 個任務\n`);

  jobs?.forEach((job, index) => {
    const metadata = job.metadata as any;
    const displayTitle = metadata?.title || (job.keywords && job.keywords[0]) || 'Untitled';
    console.log(`${index + 1}. [${job.status}] ${displayTitle}`);
    console.log(`   ID: ${job.id}`);
    console.log(`   建立: ${new Date(job.created_at).toLocaleString('zh-TW')}`);
    console.log(`   開始: ${job.started_at ? new Date(job.started_at).toLocaleString('zh-TW') : 'null'}`);
    console.log('');
  });
}

testQuery();
