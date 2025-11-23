#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkStatuses() {
  const { data, error } = await supabase
    .from('article_jobs')
    .select('status, id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent job statuses (最近 50 筆):');
  const statusCounts = new Map<string, number>();
  data?.forEach(job => {
    statusCounts.set(job.status, (statusCounts.get(job.status) || 0) + 1);
  });

  console.log('\nStatus distribution:');
  Array.from(statusCounts.entries()).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n最近 5 筆任務詳情:');
  data?.slice(0, 5).forEach(job => {
    console.log(`  ID: ${job.id}, Status: ${job.status}, Created: ${job.created_at}`);
  });
}

checkStatuses();
