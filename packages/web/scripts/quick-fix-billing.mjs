// 快速補扣腳本
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 載入 .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('錯誤: 請確保 .env.local 中有設定 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  console.log('[Billing Fix] 檢查過去 14 天的任務...');

  // 直接用 PostgreSQL JSON 查詢 billing_status = 'failed' 的任務
  const { data: jobs, error: queryError } = await supabase
    .from('article_jobs')
    .select('id, company_id, status, metadata')
    .in('status', ['completed', 'scheduled', 'published'])
    .gte('created_at', since)
    .filter('metadata->>billing_status', 'eq', 'failed');

  if (queryError) {
    console.error('查詢錯誤:', queryError);
    process.exit(1);
  }

  const failedJobs = jobs || [];
  console.log('[Billing Fix] 找到 ' + failedJobs.length + ' 個扣款失敗的任務');

  if (failedJobs.length === 0) {
    console.log('✅ 沒有需要補扣的任務');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  // 處理前 200 個
  for (const job of failedJobs.slice(0, 200)) {
    const { data, error } = await supabase.rpc('deduct_article_quota', {
      p_company_id: job.company_id,
      p_article_job_id: job.id,
      p_user_id: null,
      p_article_title: null,
      p_keywords: null
    });

    if (error) {
      console.log('  ❌ ' + job.id.slice(0, 8) + '...: ' + error.message.slice(0, 50));
      failCount++;
      continue;
    }

    if (!data.success) {
      console.log('  ❌ ' + job.id.slice(0, 8) + '...: ' + (data.error || data.message));
      failCount++;
      continue;
    }

    console.log('  ✅ ' + job.id.slice(0, 8) + '...: ' + data.deducted_from);
    successCount++;

    // 更新 metadata
    await supabase.from('article_jobs').update({
      metadata: {
        ...job.metadata,
        billing_status: 'reconciled',
        billing_reconciled_at: new Date().toISOString(),
        billing_reconciled_by: 'quick-fix-billing'
      }
    }).eq('id', job.id);
  }

  console.log('');
  console.log('='.repeat(40));
  console.log('總計：成功 ' + successCount + '，失敗 ' + failCount);

  if (failedJobs.length > 50) {
    console.log('⚠️ 還有 ' + (failedJobs.length - 50) + ' 個任務需要處理');
    console.log('請再次執行此腳本');
  }
}

run().catch(console.error);
