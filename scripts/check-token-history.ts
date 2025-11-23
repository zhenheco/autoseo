import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokenHistory() {
  // 獲取最新 3 篇文章的 IDs
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('檢查最新 3 篇文章的 token 扣除記錄:\n');

  if (!articles || articles.length === 0) {
    console.log('沒有找到文章');
    return;
  }

  for (const article of articles) {
    console.log(`📄 文章: ${article.title}`);
    console.log(`   ID: ${article.id}`);
    console.log(`   建立時間: ${article.created_at}`);

    // 查詢 token usage history
    const { data: history } = await supabase
      .from('token_usage_history')
      .select('*')
      .eq('article_id', article.id)
      .single();

    if (history) {
      console.log(`   ✅ Token 已扣除:`);
      console.log(`      Amount: ${history.amount}`);
      console.log(`      Deducted at: ${history.created_at}`);
      console.log(`      Idempotency key: ${history.idempotency_key}`);
    } else {
      console.log(`   ❌ 沒有 token 扣除記錄`);
    }
    console.log('');
  }
}

checkTokenHistory();
