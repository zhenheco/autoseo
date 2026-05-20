import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== 所有使用者 ===\n');
  if (users && users.length > 0) {
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   名稱: ${user.name || '(無)'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   建立時間: ${new Date(user.created_at).toLocaleString('zh-TW')}`);
      console.log('');
    });
  } else {
    console.log('沒有使用者');
  }
}

main().catch(console.error);
