/**
 * 測試外部網站同步流程
 * 執行: npx tsx scripts/test-sync-flow.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// 載入環境變數
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSyncFlow() {
  console.log('\n🧪 開始測試外部網站同步流程\n');
  console.log('='.repeat(50));

  // 1. 測試查詢外部網站
  console.log('\n📌 Step 1: 查詢外部網站 (website_type = external)');
  const { data: externalSites, error: siteError } = await supabase
    .from('website_configs')
    .select('id, website_name, external_slug, webhook_url, is_active, sync_on_publish')
    .eq('website_type', 'external');

  if (siteError) {
    console.error('❌ 查詢失敗:', siteError.message);
    return;
  }

  console.log(`✅ 找到 ${externalSites?.length || 0} 個外部網站:`);
  externalSites?.forEach((site: Record<string, unknown>) => {
    console.log(`   - ${site.website_name} (${site.external_slug})`);
    console.log(`     webhook: ${site.webhook_url}`);
    console.log(`     active: ${site.is_active}, sync_on_publish: ${site.sync_on_publish}`);
  });

  // 2. 測試 article_sync_logs 的 external_website_id FK
  console.log('\n📌 Step 2: 檢查 article_sync_logs.external_website_id 欄位');
  const { data: logs, error: logError } = await supabase
    .from('article_sync_logs')
    .select('id, article_id, external_website_id, status')
    .not('external_website_id', 'is', null)
    .limit(5);

  if (logError) {
    console.error('❌ 查詢失敗:', logError.message);
  } else {
    console.log(`✅ 找到 ${logs?.length || 0} 筆有 external_website_id 的同步日誌`);
  }

  // 3. 測試 article_jobs.sync_target_ids 欄位
  console.log('\n📌 Step 3: 檢查 article_jobs.sync_target_ids 欄位');
  const { data: jobs, error: jobError } = await supabase
    .from('article_jobs')
    .select('id, keywords, sync_target_ids, status')
    .not('sync_target_ids', 'eq', '[]')
    .limit(5);

  if (jobError) {
    console.error('❌ 查詢失敗:', jobError.message);
  } else {
    console.log(`✅ 找到 ${jobs?.length || 0} 筆有同步目標的排程任務`);
    jobs?.forEach((job: Record<string, unknown>) => {
      const keywords = job.keywords as string[];
      console.log(`   - ${keywords?.join(', ') || '(無關鍵字)'}: ${JSON.stringify(job.sync_target_ids)}`);
    });
  }

  // 4. 模擬 sync-service 的查詢邏輯
  console.log('\n📌 Step 4: 模擬 getActiveSyncTargets 查詢');
  const { data: activeTargets, error: activeError } = await supabase
    .from('website_configs')
    .select('*')
    .eq('website_type', 'external')
    .eq('is_active', true)
    .eq('sync_on_publish', true);

  if (activeError) {
    console.error('❌ 查詢失敗:', activeError.message);
  } else {
    console.log(`✅ 找到 ${activeTargets?.length || 0} 個啟用且 sync_on_publish=true 的目標:`);
    activeTargets?.forEach((t: Record<string, unknown>) => {
      console.log(`   - ${t.website_name} (${t.external_slug})`);
      console.log(`     webhook_url: ${t.webhook_url}`);
      console.log(`     webhook_secret: ${t.webhook_secret ? '******' : '(未設定)'}`);
    });
  }

  // 5. 測試 JOIN 查詢 (retryFailedSyncs 使用的查詢)
  console.log('\n📌 Step 5: 測試 article_sync_logs JOIN website_configs 查詢');
  const { data: joinTest, error: joinError } = await supabase
    .from('article_sync_logs')
    .select(`
      id,
      status,
      external_website_id,
      website_configs!external_website_id(id, website_name, webhook_url)
    `)
    .not('external_website_id', 'is', null)
    .limit(3);

  if (joinError) {
    console.error('❌ JOIN 查詢失敗:', joinError.message);
  } else {
    console.log(`✅ JOIN 查詢成功，找到 ${joinTest?.length || 0} 筆`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 測試完成！');
}

testSyncFlow().catch(console.error);
