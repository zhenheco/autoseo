#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function testUpdateSubscription() {
  console.log('🧪 測試訂閱更新邏輯...\n')

  // 取得最新的 mandate
  const { data: mandate } = await supabase
    .from('recurring_mandates')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!mandate) {
    console.error('❌ 找不到 active mandate')
    return
  }

  console.log('✅ 找到 mandate:', mandate.mandate_no)
  console.log('   Company ID:', mandate.company_id)
  console.log('   Plan ID:', mandate.plan_id)

  // 查詢方案
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', mandate.plan_id)
    .single()

  if (planError || !plan) {
    console.error('❌ 查詢方案失敗:', planError)
    return
  }

  console.log('\n✅ 找到方案:', plan.name)
  console.log('   Slug:', plan.slug)
  console.log('   Base Tokens:', plan.base_tokens)

  // 查詢公司目前狀態
  const { data: company, error: companyQueryError } = await supabase
    .from('companies')
    .select('id, subscription_tier, subscription_ends_at, seo_token_balance')
    .eq('id', mandate.company_id)
    .single()

  if (companyQueryError) {
    console.error('❌ 查詢公司失敗:', companyQueryError)
    return
  }

  console.log('\n✅ 公司目前狀態:')
  console.log('   Tier:', company.subscription_tier)
  console.log('   Ends At:', company.subscription_ends_at)
  console.log('   Token Balance:', company.seo_token_balance)

  // 計算新值
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const newBalance = (company.seo_token_balance || 0) + plan.base_tokens

  // 對應 plan slug 到 tier
  const mapping: Record<string, 'free' | 'basic' | 'pro' | 'enterprise'> = {
    'free': 'free',
    'starter': 'basic',
    'professional': 'pro',
    'business': 'pro',
    'agency': 'enterprise',
    'lifetime-starter': 'basic',
    'lifetime-professional': 'pro',
    'lifetime-business': 'pro',
  }
  const subscriptionTier = mapping[plan.slug] || 'free'

  console.log('\n📊 準備更新為:')
  console.log('   Tier:', subscriptionTier)
  console.log('   Ends At:', nextMonth.toISOString())
  console.log('   Token Balance:', newBalance)

  // 嘗試更新
  console.log('\n🔄 執行更新...')
  const { error: updateError } = await supabase
    .from('companies')
    .update({
      subscription_tier: subscriptionTier,
      subscription_ends_at: nextMonth.toISOString(),
      seo_token_balance: newBalance,
      updated_at: now.toISOString(),
    })
    .eq('id', mandate.company_id)

  if (updateError) {
    console.error('\n❌ 更新失敗!')
    console.error('錯誤:', updateError)
    console.error('錯誤訊息:', updateError.message)
    console.error('錯誤代碼:', updateError.code)
    console.error('錯誤詳情:', updateError.details)
    console.error('錯誤提示:', updateError.hint)
  } else {
    console.log('\n✅ 更新成功！')

    // 驗證更新
    const { data: verifyCompany } = await supabase
      .from('companies')
      .select('subscription_tier, subscription_ends_at, seo_token_balance')
      .eq('id', mandate.company_id)
      .single()

    console.log('\n驗證更新後的值:')
    console.log('   Tier:', verifyCompany?.subscription_tier)
    console.log('   Ends At:', verifyCompany?.subscription_ends_at)
    console.log('   Token Balance:', verifyCompany?.seo_token_balance)
  }

  // 測試 company_subscriptions
  console.log('\n\n🔄 測試 company_subscriptions 表...')
  const periodStart = now.toISOString()
  const periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

  const { error: subscriptionError } = await supabase
    .from('company_subscriptions')
    .upsert({
      company_id: mandate.company_id,
      plan_id: mandate.plan_id,
      status: 'active',
      purchased_token_balance: 0,
      monthly_quota_balance: plan.base_tokens,
      monthly_token_quota: plan.base_tokens,
      is_lifetime: false,
      lifetime_discount: 1.0,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    })

  if (subscriptionError) {
    console.error('❌ 插入/更新 company_subscriptions 失敗:', subscriptionError)
  } else {
    console.log('✅ company_subscriptions 更新成功')
  }

  // 測試 token_balance_changes
  console.log('\n🔄 測試 token_balance_changes 表...')
  const { error: tokenError } = await supabase
    .from('token_balance_changes')
    .insert({
      company_id: mandate.company_id,
      change_type: 'quota_renewal',
      amount: plan.base_tokens,
      balance_before: company.seo_token_balance || 0,
      balance_after: newBalance,
      description: `測試 - 訂閱 ${plan.name} 方案`,
    })

  if (tokenError) {
    console.error('❌ 插入 token_balance_changes 失敗:', tokenError)
  } else {
    console.log('✅ token_balance_changes 插入成功')
  }
}

testUpdateSubscription()
  .catch(console.error)
  .finally(() => process.exit(0))
