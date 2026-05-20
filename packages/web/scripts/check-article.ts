import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: article } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('id', '333769c3-dc8a-47d9-a361-18ecab7ce189')
    .single();

  if (!article) {
    console.log('文章不存在');
    return;
  }

  console.log('\n=== 文章資訊 ===');
  console.log('ID:', article.id);
  console.log('標題:', article.title);
  console.log('狀態:', article.status);
  console.log('HTML 長度:', article.html_content?.length || 0);
  console.log('Markdown 長度:', article.markdown_content?.length || 0);
  console.log('\n=== HTML 內容前 500 字元 ===');
  console.log(article.html_content?.substring(0, 500));
  console.log('\n=== Markdown 內容前 500 字元 ===');
  console.log(article.markdown_content?.substring(0, 500));
}

main().catch(console.error);
