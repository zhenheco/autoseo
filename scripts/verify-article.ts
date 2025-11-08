import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const articleId = 'af1b10ac-149c-414b-817b-ba78269968b9';

  const { data: article } = await supabase
    .from('generated_articles')
    .select('id, title, status, html_content, markdown_content')
    .eq('id', articleId)
    .single();

  if (!article) {
    console.log('文章不存在');
    return;
  }

  console.log('\n=== 文章驗證結果 ===');
  console.log('ID:', article.id);
  console.log('標題:', article.title);
  console.log('狀態:', article.status);
  console.log('HTML 長度:', article.html_content?.length || 0);
  console.log('Markdown 長度:', article.markdown_content?.length || 0);

  if (article.html_content && article.html_content.length > 0) {
    console.log('\n✅ HTML 內容已成功儲存');
    console.log('\nHTML 內容前 200 字元:');
    console.log(article.html_content.substring(0, 200));
  } else {
    console.log('\n❌ HTML 內容為空');
  }

  if (article.markdown_content && article.markdown_content.length > 0) {
    console.log('\n✅ Markdown 內容已成功儲存');
  } else {
    console.log('\n❌ Markdown 內容為空');
  }
}

main().catch(console.error);
