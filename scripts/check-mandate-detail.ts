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

async function checkMandateDetail() {
  console.log('🔍 檢查 pending mandate 的詳細資訊...\n')

  const mandateId = '0b279b40-1f60-4d06-b01c-806657ea05eb'
  const { data: mandate, error: mandateError } = await supabase
    .from('recurring_mandates')
    .select('*')
    .eq('id', mandateId)
    .single()

  if (mandateError || !mandate) {
    console.error('❌ 查詢 mandate 失敗:', mandateError)
    return
  }

  console.log('📋 Mandate 詳細資訊:')
  Object.entries(mandate).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`)
  })

  console.log('\n🏢 查詢公司資訊...')
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', mandate.company_id)
    .single()

  if (companyError || !company) {
    console.error('❌ 查詢公司失敗:', companyError)
    return
  }

  console.log('✅ 公司資訊:')
  console.log(`  ID: ${company.id}`)
  console.log(`  名稱: ${company.name}`)
  console.log(`  subscription_tier: ${company.subscription_tier}`)
  console.log(`  subscription_ends_at: ${company.subscription_ends_at}`)
  console.log(`  seo_token_balance: ${company.seo_token_balance}`)

  console.log('\n📦 查詢訂閱方案...')
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', mandate.plan_id)
    .single()

  if (planError || !plan) {
    console.error('❌ 查詢方案失敗:', planError)
    return
  }

  console.log('✅ 訂閱方案:')
  console.log(`  ID: ${plan.id}`)
  console.log(`  名稱: ${plan.name}`)
  console.log(`  Slug: ${plan.slug}`)
  console.log(`  Base Tokens: ${plan.base_tokens}`)

  // 檢查是否有 payment 或 order
  console.log('\n💳 查詢付款相關記錄...')
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('company_id', mandate.company_id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!ordersError && orders && orders.length > 0) {
    console.log(`✅ 找到 ${orders.length} 個訂單:`)
    for (const order of orders) {
      console.log(`  Order: ${order.id}`)
      console.log(`    - 狀態: ${order.status}`)
      console.log(`    - 建立時間: ${order.created_at}`)
      console.log(`    - 金額: ${order.amount} ${order.currency}`)
    }
  } else {
    console.log('❌ 沒有找到相關訂單')
  }

  // 檢查 mandate 是否應該被激活
  console.log('\n⚙️ Mandate 狀態分析:')
  console.log(`  狀態: ${mandate.status}`)
  console.log(`  應該是: pending（等待首次付款）或 active（已啟用）`)
  if (mandate.status === 'pending') {
    console.log('  ⚠️ ISSUE: Mandate 仍在 pending 狀態，表示首次付款還未完成或未被處理')
  }
}

checkMandateDetail()
  .catch(console.error)
  .finally(() => process.exit(0))
