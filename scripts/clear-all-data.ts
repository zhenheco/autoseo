#!/usr/bin/env tsx
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

async function clearAllData() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Clear All] ❌ 缺少必要的環境變數');
    console.error('SUPABASE_URL:', !!supabaseUrl);
    console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);
  console.log('[Clear All] 🗑️  開始清空所有數據...\n');

  // 1. 清空文章任務
  console.log('[Clear All] 🔄 清空文章任務...');
  const { error: jobsError, count: jobsCount } = await supabase
    .from('article_jobs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (jobsError) {
    console.error('[Clear All] ❌ 清空任務失敗:', jobsError);
  } else {
    console.log(`[Clear All] ✅ 已刪除 ${jobsCount || 0} 個任務\n`);
  }

  // 2. 清空生成的文章
  console.log('[Clear All] 📄 清空生成的文章...');
  const { error: articlesError, count: articlesCount } = await supabase
    .from('generated_articles')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (articlesError) {
    console.error('[Clear All] ❌ 清空文章失敗:', articlesError);
  } else {
    console.log(`[Clear All] ✅ 已刪除 ${articlesCount || 0} 篇文章\n`);
  }

  // 3. 清空圖片記錄
  console.log('[Clear All] 🖼️  清空圖片記錄...');
  const { error: imagesError, count: imagesCount } = await supabase
    .from('article_images')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (imagesError) {
    console.error('[Clear All] ❌ 清空圖片失敗:', imagesError);
  } else {
    console.log(`[Clear All] ✅ 已刪除 ${imagesCount || 0} 張圖片記錄\n`);
  }

  console.log('[Clear All] 🎉 所有數據已清空完成！');
  console.log('[Clear All] 📊 總計：');
  console.log(`  - 任務: ${jobsCount || 0} 個`);
  console.log(`  - 文章: ${articlesCount || 0} 篇`);
  console.log(`  - 圖片: ${imagesCount || 0} 張`);
}

clearAllData().catch(console.error);
