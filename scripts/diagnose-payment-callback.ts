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

async function diagnoseMandates() {
  console.log('🔍 支付回調問題診斷工具\n')
  console.log('='.repeat(80))

  // 1. 檢查 Mandate 狀態分佈
  console.log('\n1️⃣ 檢查所有 Mandate 狀態分佈...\n')

  const { data: allMandates, error: mandatesError } = await supabase
    .from('recurring_mandates')
    .select('status')

  if (mandatesError) {
    console.error('❌ 查詢 mandates 失敗:', mandatesError.message)
    return
  }

  const statusCounts: Record<string, number> = {}
  allMandates?.forEach(m => {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1
  })

  console.log('Mandate 狀態統計:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })

  if (statusCounts['pending'] && statusCounts['pending'] > 0) {
    console.log(
      `\n⚠️ 發現 ${statusCounts['pending']} 個 PENDING mandate - 授權回調可能未被接收`
    )
  }

  // 2. 檢查最近的 Mandate 細節
  console.log('\n2️⃣ 檢查最近的 Mandate...\n')

  const { data: latestMandate, error: latestError } = await supabase
    .from('recurring_mandates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestError) {
    console.error('❌ 查詢最新 mandate 失敗:', latestError.message)
    return
  }

  if (!latestMandate) {
    console.log('❌ 沒有找到任何 mandate')
    return
  }

  console.log('最新 Mandate 詳情:')
  console.log(`  ID: ${latestMandate.id}`)
  console.log(`  No: ${latestMandate.mandate_no}`)
  console.log(`  狀態: ${latestMandate.status}`)
  console.log(`  建立時間: ${latestMandate.created_at}`)
  console.log(`  啟用時間: ${latestMandate.activated_at || '❌ NULL'}`)
  console.log(`  newebpay_response: ${latestMandate.newebpay_response ? '✅ 有數據' : '❌ NULL'}`)

  // 3. 檢查相關的付款訂單
  console.log('\n3️⃣ 檢查相關的付款訂單...\n')

  if (latestMandate.first_payment_order_id) {
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('id', latestMandate.first_payment_order_id)
      .single()

    if (!orderError && order) {
      console.log('首次付款訂單:')
      console.log(`  ID: ${order.id}`)
      console.log(`  No: ${order.order_no}`)
      console.log(`  狀態: ${order.status}`)
      console.log(`  金額: ${order.amount}`)
      console.log(`  newebpay_status: ${order.newebpay_status || 'NULL'}`)
      console.log(`  paid_at: ${order.paid_at || '❌ NULL'}`)
    } else {
      console.log('❌ 未找到相關付款訂單')
    }
  }

  // 4. 檢查公司訂閱狀態
  console.log('\n4️⃣ 檢查公司訂閱狀態...\n')

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', latestMandate.company_id)
    .single()

  if (!companyError && company) {
    console.log('公司訂閱狀態:')
    console.log(`  ID: ${company.id}`)
    console.log(`  名稱: ${company.name}`)
    console.log(`  subscription_tier: ${company.subscription_tier}`)
    console.log(`  subscription_ends_at: ${company.subscription_ends_at || '❌ NULL'}`)
    console.log(`  seo_token_balance: ${company.seo_token_balance}`)

    if (company.subscription_tier === 'free') {
      console.log('\n❌ ISSUE: subscription_tier 仍為 free - 訂閱未更新')
    }
  }

  // 5. 檢查訂閱記錄
  console.log('\n5️⃣ 檢查公司訂閱記錄...\n')

  const { data: subscriptions, error: subsError } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('company_id', latestMandate.company_id)

  if (!subsError && subscriptions && subscriptions.length > 0) {
    console.log(`✅ 找到 ${subscriptions.length} 個訂閱記錄:`)
    subscriptions.forEach((sub, idx) => {
      console.log(`\n  訂閱 ${idx + 1}:`)
      console.log(`    狀態: ${sub.status}`)
      console.log(`    方案: ${sub.plan_id}`)
      console.log(`    月度配額: ${sub.monthly_token_quota}`)
      console.log(`    期間: ${sub.current_period_start} → ${sub.current_period_end}`)
    })
  } else {
    console.log('❌ 未找到訂閱記錄 - 授權成功邏輯未執行')
  }

  // 6. 檢查代幣變動記錄
  console.log('\n6️⃣ 檢查代幣變動記錄...\n')

  const { data: tokenChanges, error: tokenError } = await supabase
    .from('token_balance_changes')
    .select('*')
    .eq('company_id', latestMandate.company_id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!tokenError && tokenChanges && tokenChanges.length > 0) {
    console.log(`✅ 找到 ${tokenChanges.length} 個代幣變動記錄:`)
    tokenChanges.forEach((change) => {
      console.log(`\n  ${change.change_type}:`)
      console.log(`    時間: ${change.created_at}`)
      console.log(`    變動: ${change.amount > 0 ? '+' : ''}${change.amount}`)
      console.log(`    描述: ${change.description}`)
    })
  } else {
    console.log('❌ 未找到代幣變動記錄 - 授權成功邏輯未執行')
  }

  // 7. 診斷總結
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 診斷結論:\n')

  const hasCallback = latestMandate.newebpay_response !== null
  const isActivated = latestMandate.status === 'active'
  const hasSubscription = subscriptions && subscriptions.length > 0
  const hasTokenChanges = tokenChanges && tokenChanges.length > 0

  console.log(`授權回調接收: ${hasCallback ? '✅' : '❌'}`)
  console.log(`Mandate 已激活: ${isActivated ? '✅' : '❌'}`)
  console.log(`訂閱記錄已建立: ${hasSubscription ? '✅' : '❌'}`)
  console.log(`代幣已增加: ${hasTokenChanges ? '✅' : '❌'}`)

  if (!hasCallback) {
    console.log('\n🔴 主要問題: 授權回調從未被接收！')
    console.log('\n檢查項目:')
    console.log('  1. 藍新金流是否已發送 Period callback？')
    console.log('  2. 回調 URL 配置是否正確？')
    console.log('  3. 應用是否可以接收入站 HTTP 請求？')
    console.log('  4. 防火牆/安全組是否允許回調訪問？')
  } else if (!isActivated) {
    console.log('\n🟡 主要問題: 回調已收到但處理失敗')
    console.log('\n檢查項目:')
    console.log('  1. 回調解密是否成功？')
    console.log('  2. 資料庫更新是否有錯誤？')
    console.log('  3. RLS 策略是否阻止更新？')
  } else {
    console.log('\n🟢 狀態正常: 授權流程完成，訂閱已更新')
  }

  console.log('\n' + '='.repeat(80))
}

diagnoseMandates()
  .catch(console.error)
  .finally(() => process.exit(0))
