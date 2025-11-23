import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 檢查最近 5 篇文章的 html_content...\n');

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title, created_at, html_content, markdown_content')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('查詢錯誤:', error);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log('❌ 沒有找到任何文章');
    process.exit(0);
  }

  articles.forEach((article, index) => {
    console.log(`\n[${ index + 1}] 文章: ${article.title}`);
    console.log(`   ID: ${article.id}`);
    console.log(`   建立時間: ${new Date(article.created_at).toLocaleString('zh-TW')}`);
    console.log(`   ---`);

    const htmlContent = article.html_content || '';
    const markdownContent = article.markdown_content || '';

    console.log(`   HTML Content 長度: ${htmlContent.length}`);
    console.log(`   Markdown Content 長度: ${markdownContent.length}`);

    // 檢查 html_content 前 500 字
    const htmlPreview = htmlContent.substring(0, 500);
    console.log(`\n   HTML Content 預覽 (前 500 字):`);
    console.log(`   ${htmlPreview}`);

    // 分析是否為真正的 HTML
    const startsWithHtml = htmlContent.trim().startsWith('<');
    const containsMarkdownSyntax = ['##', '**', '```', '* ', '- '].some(pattern =>
      htmlContent.substring(0, 1000).includes(pattern)
    );

    console.log(`\n   ✓ 是否以 HTML 標籤開頭: ${startsWithHtml ? '✅ 是' : '❌ 否'}`);
    console.log(`   ✓ 是否包含 Markdown 語法: ${containsMarkdownSyntax ? '⚠️  是 (有問題!)' : '✅ 否'}`);

    if (!startsWithHtml || containsMarkdownSyntax) {
      console.log(`\n   🚨 問題: html_content 可能不是真正的 HTML!`);
    } else {
      console.log(`\n   ✅ html_content 看起來是正確的 HTML`);
    }

    console.log('\n' + '='.repeat(80));
  });

  console.log('\n\n📊 總結:');
  const problematicArticles = articles.filter(a => {
    const html = a.html_content || '';
    const startsWithHtml = html.trim().startsWith('<');
    const containsMarkdown = ['##', '**', '```'].some(p => html.substring(0, 1000).includes(p));
    return !startsWithHtml || containsMarkdown;
  });

  if (problematicArticles.length > 0) {
    console.log(`⚠️  發現 ${problematicArticles.length} 篇文章的 html_content 有問題`);
    console.log(`建議: 重新生成這些文章以測試修復效果`);
  } else {
    console.log(`✅ 所有文章的 html_content 都是正確的 HTML 格式`);
  }
})();
