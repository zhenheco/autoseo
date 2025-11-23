import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  console.log('\n=== 查詢測試文章 ===\n');

  // 查詢所有文章
  const { data: articles, error: articlesError } = await supabase
    .from('generated_articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (articlesError) {
    console.error('❌ 查詢文章錯誤:', articlesError);
    return;
  }

  console.log(`找到 ${articles?.length || 0} 篇文章\n`);

  if (!articles || articles.length === 0) {
    console.log('沒有文章需要刪除');
    return;
  }

  // 顯示文章列表
  articles.forEach((a, i) => {
    console.log(`${i + 1}. ${a.title || '(無標題)'}`);
    console.log(`   ID: ${a.id}`);
    console.log(`   Job ID: ${a.job_id}`);
    console.log(`   建立時間: ${a.created_at}`);
    console.log('');
  });

  // 查詢包含 "AI時代的SEO應該怎麼做" 的文章
  const testArticles = articles.filter(
    (a) => a.title && a.title.includes('AI時代的SEO應該怎麼做')
  );

  if (testArticles.length === 0) {
    console.log('沒有找到包含 "AI時代的SEO應該怎麼做" 的測試文章');
    return;
  }

  console.log(`\n找到 ${testArticles.length} 篇測試文章，準備刪除...\n`);

  for (const article of testArticles) {
    console.log(`刪除: ${article.title}`);
    console.log(`  ID: ${article.id}`);

    const { error: deleteError } = await supabase
      .from('generated_articles')
      .delete()
      .eq('id', article.id);

    if (deleteError) {
      console.error(`  ❌ 刪除失敗:`, deleteError);
    } else {
      console.log(`  ✅ 已刪除`);
    }
    console.log('');
  }

  console.log('=== 完成 ===\n');
}

main().catch(console.error);
