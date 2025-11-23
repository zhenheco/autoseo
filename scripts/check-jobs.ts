#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

const supabaseUrl = 'https://vdjzeregvyimgzflfalv.supabase.co';
const supabaseKey = 'REDACTED_SUPABASE_KEY';

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function checkJobs() {
  const { data, error } = await supabase
    .from('article_jobs')
    .select('id, keywords, status, created_at, started_at, metadata')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n最近 10 個任務：\n');
  data?.forEach((job, index) => {
    const metadata = job.metadata as any;
    const displayTitle = metadata?.title || job.title || (job.keywords && job.keywords[0]) || 'Untitled';
    console.log(`${index + 1}. [${job.status}] ${displayTitle}`);
    console.log(`   ID: ${job.id}`);
    console.log(`   建立時間: ${new Date(job.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
    console.log(`   開始時間: ${job.started_at ? new Date(job.started_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '尚未開始'}`);
    console.log('');
  });
}

checkJobs();
