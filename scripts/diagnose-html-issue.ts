/**
 * 診斷 HTML 內容問題
 * 檢查最新文章的 html_content 和 markdown_content
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少環境變數: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 開始診斷最新文章...\n');

  // 查詢最新的 3 篇文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title, created_at, html_content, markdown_content')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('❌ 查詢失敗:', error);
    return;
  }

  if (!articles || articles.length === 0) {
    console.log('⚠️  沒有找到任何文章');
    return;
  }

  for (const article of articles) {
    console.log('━'.repeat(80));
    console.log(`📄 文章: ${article.title}`);
    console.log(`🆔 ID: ${article.id}`);
    console.log(`📅 建立時間: ${article.created_at}`);
    console.log('');

    // 檢查 HTML 內容
    const htmlContent = article.html_content || '';
    const markdownContent = article.markdown_content || '';

    console.log('📊 HTML 內容分析:');
    console.log(`  長度: ${htmlContent.length} 字元`);
    console.log(`  開頭 100 字元: ${htmlContent.substring(0, 100)}`);
    console.log(`  是否包含 HTML 標籤: ${htmlContent.includes('<')}`);
    console.log(`  是否包含 <p> 標籤: ${htmlContent.includes('<p>')}`);
    console.log(`  是否包含 <h2> 標籤: ${htmlContent.includes('<h2>')}`);
    console.log(`  是否包含 Markdown 語法 ##: ${htmlContent.includes('##')}`);
    console.log(`  是否包含 Markdown 語法 **: ${htmlContent.includes('**')}`);
    console.log('');

    console.log('📊 Markdown 內容分析:');
    console.log(`  長度: ${markdownContent.length} 字元`);
    console.log(`  開頭 100 字元: ${markdownContent.substring(0, 100)}`);
    console.log(`  是否包含 ## 標題: ${markdownContent.includes('##')}`);
    console.log(`  是否包含 ** 粗體: ${markdownContent.includes('**')}`);
    console.log('');

    // 判斷問題
    if (htmlContent.includes('##') || htmlContent.includes('**')) {
      console.log('⚠️  警告: html_content 包含 Markdown 語法！');
      console.log('❌ 問題確認: html_content 儲存的是 Markdown 而非 HTML');
    } else if (htmlContent.includes('<p>') && htmlContent.includes('<')) {
      console.log('✅ html_content 看起來是正確的 HTML');
    } else {
      console.log('❓ html_content 既不像 HTML 也不像 Markdown');
    }

    console.log('');
  }

  console.log('━'.repeat(80));
  console.log('\n✅ 診斷完成');
}

diagnose().catch(console.error);
