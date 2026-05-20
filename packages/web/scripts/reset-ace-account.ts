#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少環境變數')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function resetAceAccount() {
  console.log('🚀 開始重置 ace@zhenhe-co.com 帳號...\n')

  const targetEmail = 'ace@zhenhe-co.com'

  console.log(`查詢 ${targetEmail} 的使用者資料...`)

  const { data: userData, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error('❌ 無法查詢使用者:', userError)
    return
  }

  const user = userData.users.find((u) => u.email === targetEmail)
  if (!user) {
    console.log(`⚠️  找不到 ${targetEmail}`)
    return
  }

  console.log(`✅ 找到使用者 ID: ${user.id}`)

  const { data: member, error: memberError } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    console.error('❌ 查詢公司成員失敗:', memberError)
    return
  }

  if (!member) {
    console.log('⚠️  找不到公司記錄')
    return
  }

  await resetCompany(member.company_id, targetEmail)
}

async function resetCompany(companyId: string, email: string) {
  console.log(`\n✅ 找到公司 ID: ${companyId}`)

  console.log('\n開始清除資料...')

  console.log('刪除 recurring_mandates (必須先刪除以避免外鍵約束)...')
  const { error: mandatesError } = await supabase
    .from('recurring_mandates')
    .delete()
    .eq('company_id', companyId)
  if (mandatesError) console.error('❌', mandatesError)
  else console.log('✅ recurring_mandates 已刪除')

  console.log('刪除 payment_orders...')
  const { error: ordersError } = await supabase
    .from('payment_orders')
    .delete()
    .eq('company_id', companyId)
  if (ordersError) console.error('❌', ordersError)
  else console.log('✅ payment_orders 已刪除')

  console.log('刪除 company_subscriptions...')
  const { error: subsError } = await supabase
    .from('company_subscriptions')
    .delete()
    .eq('company_id', companyId)
  if (subsError) console.error('❌', subsError)
  else console.log('✅ company_subscriptions 已刪除')

  console.log('刪除 token_balance_changes (purchase/quota_renewal)...')
  const { error: tokenError } = await supabase
    .from('token_balance_changes')
    .delete()
    .eq('company_id', companyId)
    .in('change_type', ['purchase', 'quota_renewal'])
  if (tokenError) console.error('❌', tokenError)
  else console.log('✅ token_balance_changes 已刪除')

  console.log('\n重置 companies 表...')
  const { error: resetError } = await supabase
    .from('companies')
    .update({
      subscription_tier: 'free',
      subscription_ends_at: null,
      seo_token_balance: 10000,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId)

  if (resetError) {
    console.error('❌ 重置失敗:', resetError)
  } else {
    console.log('✅ companies 表已重置為 free tier')
  }

  console.log('\n✨ 重置完成')

  const { data: verifyCompany } = await supabase
    .from('companies')
    .select('name, subscription_tier, seo_token_balance, subscription_ends_at')
    .eq('id', companyId)
    .single()

  if (verifyCompany) {
    console.log('\n驗證結果:')
    console.log('  - 電子郵件:', email)
    console.log('  - 公司名稱:', verifyCompany.name)
    console.log('  - 方案:', verifyCompany.subscription_tier)
    console.log('  - Token 餘額:', verifyCompany.seo_token_balance)
    console.log('  - 到期日:', verifyCompany.subscription_ends_at || 'NULL')
  }
}

resetAceAccount()
  .catch(console.error)
  .finally(() => process.exit(0))
