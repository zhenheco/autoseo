#!/usr/bin/env tsx
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient<Database>(supabaseUrl!, supabaseKey!);

async function checkGeneratedArticles() {
  console.log('[Check Articles] 查詢生成的文章...\n');

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title, status, created_at, published_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[Check Articles] ❌ 查詢失敗:', error);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log('[Check Articles] ✅ 沒有生成的文章');
    return;
  }

  console.log(`[Check Articles] 📊 找到 ${articles.length} 篇文章\n`);

  articles.forEach((article) => {
    const statusEmoji = {
      draft: '📝',
      published: '✅',
      scheduled: '⏰',
    }[article.status] || '❓';

    console.log(`${statusEmoji} [${article.status.toUpperCase()}] ${article.title}`);
    console.log(`   ID: ${article.id}`);
    console.log(`   建立時間: ${new Date(article.created_at).toLocaleString('zh-TW')}`);

    if (article.published_at) {
      console.log(`   發布時間: ${new Date(article.published_at).toLocaleString('zh-TW')}`);
    }

    console.log('');
  });
}

checkGeneratedArticles().catch(console.error);
