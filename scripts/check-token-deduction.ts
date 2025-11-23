import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokenDeduction() {
  const { data: jobs } = await supabase
    .from('article_jobs')
    .select('id, created_at, metadata, status')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('最新 5 個 article_jobs:');
  console.log('');

  jobs?.forEach((job, index) => {
    console.log(`Job ${index + 1}:`);
    console.log(`  ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Token deduction error: ${(job.metadata as Record<string, unknown>)?.token_deduction_error || 'None'}`);
    console.log(`  Saved article ID: ${(job.metadata as Record<string, unknown>)?.saved_article_id || 'None'}`);
    console.log('');
  });
}

checkTokenDeduction();
