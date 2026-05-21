import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function listWebsites() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('website_configs')
    .select('*')
    .limit(10);

  if (error) {
    console.error('❌ 查詢失敗:', error);
    process.exit(1);
  }

  console.log('=== 網站列表 ===\n');
  if (data && data.length > 0) {
    data.forEach(site => {
      console.log(`ID: ${site.id}`);
      console.log(`名稱: ${site.name}`);
      console.log(`網域: ${site.domain}`);
      console.log('---');
    });
  } else {
    console.log('沒有找到任何網站設定');
  }
}

listWebsites().catch(console.error);
