import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function prepareTestData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const companyId = 'cbb4ad22-8078-4b20-89d0-25a10186fce3';

  const { data: users } = await supabase.auth.admin.listUsers();
  console.log('現有使用者數量:', users.users.length);

  let userId: string;
  if (users.users.length > 0) {
    userId = users.users[0].id;
    console.log('使用現有使用者:', userId);
  } else {
    console.log('\n📝 建立測試使用者...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'test123456',
      email_confirm: true,
    });

    if (authError) {
      console.error('❌ 建立使用者失敗:', authError.message);
      process.exit(1);
    }

    userId = authData.user!.id;
    console.log('✅ 測試使用者已建立:', userId);
  }

  console.log('\n📝 檢查公司成員...');
  const { data: existingMember } = await supabase
    .from('company_members')
    .select('*')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .single();

  if (existingMember) {
    console.log('✅ 成員關係已存在');
  } else {
    console.log('📝 建立公司成員關係...');
    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: companyId,
        user_id: userId,
        role: 'owner',
      });

    if (memberError) {
      console.error('❌ 建立成員關係失敗:', memberError.message);
      process.exit(1);
    }

    console.log('✅ 公司成員關係已建立');
  }

  console.log('\n📝 檢查網站配置...');
  const { data: websites } = await supabase
    .from('website_configs')
    .select('*')
    .eq('company_id', companyId);

  console.log('網站數量:', websites?.length || 0);

  if (!websites || websites.length === 0) {
    console.log('📝 建立測試網站...');
    const { data: website, error: websiteError } = await supabase
      .from('website_configs')
      .insert({
        company_id: companyId,
        website_url: 'https://test-blog.example.com',
        wordpress_username: 'test_user',
        wordpress_app_password: 'test_password',
        cname_verified: false,
      })
      .select('id')
      .single();

    if (websiteError) {
      console.error('❌ 建立網站失敗:', websiteError.message);
      process.exit(1);
    }

    console.log('✅ 測試網站已建立:', website.id);
  } else {
    console.log('✅ 使用現有網站:', websites[0].id);
  }

  console.log('\n✅ 測試資料準備完成！');
}

prepareTestData();
