import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title, html_content, markdown_content')
    .eq('id', 'b08a46be-dc6f-4de6-bf48-68f96cec476a')
    .single();

  if (error) {
    console.error('查詢錯誤:', error);
    process.exit(1);
  }

  console.log('文章 ID:', data.id);
  console.log('標題:', data.title);
  console.log('\n=== HTML 內容前 500 字元 ===');
  console.log(data.html_content?.substring(0, 500) || 'NULL');
  console.log('\n=== Markdown 內容前 500 字元 ===');
  console.log(data.markdown_content?.substring(0, 500) || 'NULL');

  const isHtml = data.html_content?.trim().startsWith('<');
  const isMarkdown = data.html_content?.includes('##') || data.html_content?.includes('**');
  console.log('\n=== 格式分析 ===');
  console.log('html_content 是否為 HTML 格式:', isHtml);
  console.log('html_content 是否包含 Markdown 語法:', isMarkdown);
})();
