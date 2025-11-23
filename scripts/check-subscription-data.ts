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
  // 查詢公司訂閱資訊
  const { data: subscriptions, error } = await supabase
    .from('company_subscriptions')
    .select('*, companies(subscription_tier), subscription_plans(name, slug)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('查詢錯誤:', error);
    process.exit(1);
  }

  console.log('=== 最近 5 筆有效訂閱 ===');
  subscriptions?.forEach((sub, i) => {
    console.log(`\n[${i + 1}] Company ID: ${sub.company_id}`);
    console.log(`  方案: ${sub.plan_id}`);
    console.log(`  方案詳情:`, sub.subscription_plans);
    console.log(`  Companies.subscription_tier: ${(sub.companies as any)?.subscription_tier}`);
    console.log(`  月配額餘額: ${sub.monthly_quota_balance}`);
    console.log(`  購買餘額: ${sub.purchased_token_balance}`);
    console.log(`  月配額總額: ${sub.monthly_token_quota}`);
  });

  // 查詢所有方案
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('created_at', { ascending: true });

  console.log('\n\n=== 所有訂閱方案 ===');
  plans?.forEach((plan) => {
    console.log(`\n- ID: ${plan.id}`);
    console.log(`  Name: ${plan.name}`);
    console.log(`  Slug: ${plan.slug}`);
    console.log(`  基本 Tokens: ${plan.base_tokens}`);
    console.log(`  Is Active: ${plan.is_active}`);
  });
})();
