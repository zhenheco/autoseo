require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createTestUser() {
  const testEmail = 'test@autopilot-seo.com';
  const testPassword = 'Test123456!';

  console.log('建立測試帳號...');
  console.log('Email:', testEmail);
  console.log('Password:', testPassword);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('✅ 測試帳號已存在');

      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('❌ 查詢用戶失敗:', listError);
        return;
      }

      const testUser = users.find(u => u.email === testEmail);
      if (testUser) {
        console.log('找到測試用戶 ID:', testUser.id);

        const { data: companies } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', testUser.id)
          .limit(1);

        if (companies && companies.length > 0) {
          console.log('✅ 用戶已有公司:', companies[0].company_id);
        } else {
          console.log('⚠️  用戶沒有公司，正在建立...');
          await createCompanyForUser(testUser.id, testEmail);
        }
      }

      console.log('\n📝 測試帳號資訊:');
      console.log('Email:', testEmail);
      console.log('Password:', testPassword);
      return;
    }

    console.error('❌ 建立測試帳號失敗:', authError);
    return;
  }

  console.log('✅ 測試帳號建立成功!');
  console.log('User ID:', authData.user.id);

  await createCompanyForUser(authData.user.id, testEmail);

  console.log('\n📝 測試帳號資訊:');
  console.log('Email:', testEmail);
  console.log('Password:', testPassword);
}

async function createCompanyForUser(userId, email) {
  const username = email.split('@')[0];
  const random = Math.random().toString(36).substring(2, 8);
  const slug = `${username}-${random}`;

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: `${username} 的公司`,
      slug: slug,
      owner_id: userId,
      subscription_tier: 'free',
    })
    .select()
    .single();

  if (companyError) {
    console.error('❌ 建立公司失敗:', companyError);
    return;
  }

  console.log('✅ 公司建立成功:', company.id);

  const { error: memberError } = await supabase
    .from('company_members')
    .insert({
      company_id: company.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    console.error('❌ 建立成員記錄失敗:', memberError);
    return;
  }

  console.log('✅ 成員記錄建立成功');

  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .insert({
      company_id: company.id,
      plan_name: 'free',
      status: 'active',
      monthly_article_limit: 5,
      articles_used_this_month: 0,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

  if (subscriptionError) {
    console.error('❌ 建立訂閱失敗:', subscriptionError);
    return;
  }

  console.log('✅ 訂閱建立成功');
}

createTestUser().catch(console.error);
