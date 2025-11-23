#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const dbUrl = process.env.SUPABASE_DB_URL!

if (!supabaseUrl || !supabaseServiceKey || !dbUrl) {
  console.error('❌ 缺少環境變數')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function runMigrations() {
  console.log('🚀 開始執行 migrations...\n')

  console.log('📄 Migration 1: 檢查 companies 表結構')

  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('*')
    .limit(1)

  if (fetchError) {
    console.error('❌ 無法查詢 companies 表:', fetchError)
    return
  }

  if (companies && companies.length > 0) {
    const company = companies[0]
    const fields = Object.keys(company)
    console.log('當前 companies 表欄位:', fields)

    const needsMigration =
      !fields.includes('subscription_ends_at') || !fields.includes('seo_token_balance')

    if (needsMigration) {
      console.log('\n⚠️  缺少必要欄位，需要執行 migration')
      console.log('\n請在 Supabase Dashboard 的 SQL Editor 中執行以下 SQL:')
      console.log('─'.repeat(80))
      console.log(`
-- 新增 subscription_ends_at 欄位
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN companies.subscription_ends_at IS '訂閱到期日（免費方案為 NULL）';

-- 新增 seo_token_balance 欄位
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS seo_token_balance INTEGER NOT NULL DEFAULT 10000;

COMMENT ON COLUMN companies.seo_token_balance IS 'SEO Token 餘額（免費方案預設 10000）';

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_companies_subscription_ends_at ON companies(subscription_ends_at)
  WHERE subscription_ends_at IS NOT NULL;

-- 更新現有公司預設值
UPDATE companies
SET seo_token_balance = 10000
WHERE seo_token_balance IS NULL OR seo_token_balance = 0;
      `)
      console.log('─'.repeat(80))
      console.log('\n執行完成後，請重新運行此腳本繼續重置測試帳號')
      return
    } else {
      console.log('✅ 所有必要欄位已存在')
    }
  }

  console.log('\n📄 Migration 2: 重置測試帳號')
  console.log('查詢測試帳號 acejou27@gmail.com 的公司...')

  const { data: companyMember, error: memberError } = await supabase
    .from('company_members')
    .select('company_id, companies!inner(name, slug)')
    .eq('companies.owner_id', testUserId)
    .limit(1)
    .maybeSingle()

  if (memberError || !companyMember) {
    console.log('⚠️  無法直接查詢，嘗試從 profile 表查詢...')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', 'acejou27@gmail.com')
      .maybeSingle()

    if (!profile) {
      console.log('⚠️  找不到測試帳號')
      console.log('\n請手動在 Supabase Dashboard 執行:')
      console.log('─'.repeat(80))
      console.log(`
-- 查詢測試帳號的公司
SELECT cm.company_id, c.name, c.slug, c.subscription_tier, c.seo_token_balance
FROM company_members cm
JOIN companies c ON cm.company_id = c.id
WHERE cm.user_id IN (
  SELECT id FROM auth.users WHERE email = 'acejou27@gmail.com'
);

-- 刪除測試資料（將 <company_id> 替換為上面查到的 ID）
DELETE FROM payment_orders WHERE company_id = '<company_id>';
DELETE FROM recurring_mandates WHERE company_id = '<company_id>';
DELETE FROM company_subscriptions WHERE company_id = '<company_id>';
DELETE FROM token_balance_changes WHERE company_id = '<company_id>' AND change_type IN ('purchase', 'quota_renewal');

-- 重置公司為 free tier
UPDATE companies
SET
  subscription_tier = 'free',
  subscription_ends_at = NULL,
  seo_token_balance = 10000,
  updated_at = NOW()
WHERE id = '<company_id>';
      `)
      console.log('─'.repeat(80))
      return
    }

    const { data: member } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (!member) {
      console.log('⚠️  找不到測試帳號的公司記錄')
      return
    }

    companyId = member.company_id
  } else {
    companyId = companyMember.company_id
  }

  console.log(`✅ 找到測試公司 ID: ${companyId}`)

  console.log('\n開始清除測試資料...')

  console.log('刪除 payment_orders...')
  const { error: ordersError } = await supabase
    .from('payment_orders')
    .delete()
    .eq('company_id', companyId)
  if (ordersError) console.error('❌', ordersError)
  else console.log('✅ payment_orders 已刪除')

  console.log('刪除 recurring_mandates...')
  const { error: mandatesError } = await supabase
    .from('recurring_mandates')
    .delete()
    .eq('company_id', companyId)
  if (mandatesError) console.error('❌', mandatesError)
  else console.log('✅ recurring_mandates 已刪除')

  console.log('刪除 company_subscriptions...')
  const { error: subsError } = await supabase
    .from('company_subscriptions')
    .delete()
    .eq('company_id', companyId)
  if (subsError) console.error('❌', subsError)
  else console.log('✅ company_subscriptions 已刪除')

  console.log('刪除 token_balance_changes...')
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
    console.log('  - 公司名稱:', verifyCompany.name)
    console.log('  - 方案:', verifyCompany.subscription_tier)
    console.log('  - Token 餘額:', verifyCompany.seo_token_balance)
    console.log('  - 到期日:', verifyCompany.subscription_ends_at || 'NULL')
  }
}

let companyId: string
let testUserId: string

runMigrations()
  .catch(console.error)
  .finally(() => process.exit(0))
