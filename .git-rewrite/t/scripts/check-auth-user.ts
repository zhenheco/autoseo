import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Auth Users ===\n');
  if (users && users.length > 0) {
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   建立時間: ${new Date(user.created_at).toLocaleString('zh-TW')}`);
      console.log('');
    });
  } else {
    console.log('沒有使用者');
  }

  const targetUser = users.find(u => u.email === 'ace@zhenhe-co.com');

  if (!targetUser) {
    console.log('❌ 找不到 ace@zhenhe-co.com');
    return;
  }

  console.log('\n=== 檢查 ace@zhenhe-co.com 的文章 ===\n');

  const { data: jobs } = await supabase
    .from('article_jobs')
    .select('*')
    .eq('user_id', targetUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Article Jobs:');
  if (jobs && jobs.length > 0) {
    jobs.forEach((job) => {
      console.log(`\nJob ID: ${job.id}`);
      console.log(`標題: ${job.metadata?.title || job.article_title || '(無標題)'}`);
      console.log(`狀態: ${job.status}`);
      console.log(`建立時間: ${new Date(job.created_at).toLocaleString('zh-TW')}`);
    });
  } else {
    console.log('沒有 article_jobs');
  }

  const { data: articles } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('user_id', targetUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n\nGenerated Articles:');
  if (articles && articles.length > 0) {
    articles.forEach((article) => {
      console.log(`\nArticle ID: ${article.id}`);
      console.log(`標題: ${article.title}`);
      console.log(`Slug: ${article.slug}`);
      console.log(`字數: ${article.word_count || 0}`);
      console.log(`建立時間: ${new Date(article.created_at).toLocaleString('zh-TW')}`);
    });
  } else {
    console.log('沒有 generated_articles');
  }
}

main().catch(console.error);
