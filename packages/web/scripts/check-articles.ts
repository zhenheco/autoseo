import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('檢查文章資料...\n');

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title, status, created_at, company_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('查詢錯誤:', error);
    return;
  }

  console.log(`找到 ${articles?.length || 0} 篇文章:\n`);

  if (articles && articles.length > 0) {
    articles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title || '(無標題)'}`);
      console.log(`   ID: ${article.id}`);
      console.log(`   狀態: ${article.status}`);
      console.log(`   公司 ID: ${article.company_id}`);
      console.log(`   建立時間: ${new Date(article.created_at).toLocaleString('zh-TW')}`);
      console.log('');
    });
  } else {
    console.log('資料庫中沒有任何文章');
  }

  // 檢查公司成員資料
  const { data: members } = await supabase
    .from('company_members')
    .select('user_id, company_id, status')
    .eq('status', 'active');

  console.log(`\n找到 ${members?.length || 0} 個活躍的公司成員`);
  if (members && members.length > 0) {
    members.forEach((member, index) => {
      console.log(`${index + 1}. User ID: ${member.user_id.substring(0, 8)}...`);
      console.log(`   Company ID: ${member.company_id}`);
    });
  }
}

main();
