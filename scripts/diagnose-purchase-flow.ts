import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function diagnosePurchaseFlow() {
  console.log('=== 診斷購買流程問題 ===\n')

  // 1. 取得用戶
  const { data: users } = await supabase.auth.admin.listUsers()
  const aceUser = users?.users.find(u => u.email === 'ace@zhenhe-co.com')

  if (!aceUser) {
    console.log('❌ 找不到用戶')
    return
  }

  console.log(`User ID: ${aceUser.id}\n`)

  // 2. 模擬購買流程的查詢順序
  console.log('=== 步驟 1: 查詢 company_members ===')
  const { data: membership, error: memberError } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', aceUser.id)
    .single()

  if (memberError) {
    console.log(`❌ 錯誤: ${memberError.message}`)
    console.log(`   Code: ${memberError.code}`)
    return
  }

  if (!membership) {
    console.log('❌ 找不到 membership')
    return
  }

  console.log(`✅ Company ID: ${membership.company_id}\n`)

  // 3. 查詢訂閱方案（假設要購買 STARTER）
  console.log('=== 步驟 2: 查詢目標訂閱方案 ===')
  const { data: plans, error: plansError } = await supabase
    .from('subscription_plans')
    .select('id, name, slug, monthly_price')
    .eq('slug', 'starter')
    .single()

  if (plansError) {
    console.log(`❌ 錯誤: ${plansError.message}`)
  } else if (!plans) {
    console.log('❌ 找不到 STARTER 方案')
  } else {
    console.log(`✅ Plan ID: ${plans.id}`)
    console.log(`   Name: ${plans.name}`)
    console.log(`   Slug: ${plans.slug}`)
    console.log(`   Price: ${plans.monthly_price}\n`)
  }

  // 4. 關鍵步驟：查詢 companies（這裡出錯）
  console.log('=== 步驟 3: 查詢 companies 表（關鍵步驟）===')

  // 使用 Admin Client（無 RLS）
  console.log('使用 Admin Client 查詢:')
  const { data: companyAdmin, error: companyAdminError } = await supabase
    .from('companies')
    .select('id, name, subscription_tier, subscription_period, owner_id')
    .eq('id', membership.company_id)
    .single()

  if (companyAdminError) {
    console.log(`❌ Admin 查詢錯誤: ${companyAdminError.message}`)
  } else if (!companyAdmin) {
    console.log('❌ Admin 查詢回傳 null')
  } else {
    console.log(`✅ Admin 查詢成功`)
    console.log(`   ID: ${companyAdmin.id}`)
    console.log(`   Name: ${companyAdmin.name}`)
    console.log(`   Tier: ${companyAdmin.subscription_tier}`)
    console.log(`   Period: ${companyAdmin.subscription_period}`)
    console.log(`   Owner ID: ${companyAdmin.owner_id}`)
  }

  console.log()

  // 5. 檢查是否有 subscription_period 欄位
  console.log('=== 檢查 companies 表結構 ===')
  const { data: tableInfo } = await supabase
    .from('companies')
    .select('*')
    .eq('id', membership.company_id)
    .single()

  if (tableInfo) {
    console.log('公司記錄的所有欄位:')
    Object.keys(tableInfo).forEach(key => {
      console.log(`   ${key}: ${tableInfo[key]}`)
    })
  }

  console.log()

  // 6. 檢查是否有殘留的 PRO 方案資料
  console.log('=== 檢查是否有殘留的付費方案資料 ===')

  // 檢查所有訂閱記錄（包括非 active）
  const { data: allSubs } = await supabase
    .from('company_subscriptions')
    .select('*, subscription_plans(name, slug)')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })

  if (allSubs && allSubs.length > 0) {
    console.log(`找到 ${allSubs.length} 筆訂閱記錄:`)
    allSubs.forEach((sub, i) => {
      console.log(`\n   [${i + 1}] Status: ${sub.status}`)
      console.log(`       Plan: ${(sub.subscription_plans as any)?.slug || 'N/A'}`)
      console.log(`       Created: ${sub.created_at}`)
      console.log(`       Updated: ${sub.updated_at}`)
      if (sub.status !== 'active') {
        console.log(`       ⚠️  非 active 狀態`)
      }
    })
  }

  console.log()

  // 7. 檢查支付訂單記錄
  console.log('=== 檢查支付訂單記錄 ===')
  const { data: orders } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (orders && orders.length > 0) {
    console.log(`找到 ${orders.length} 筆最近的訂單:`)
    orders.forEach((order, i) => {
      console.log(`\n   [${i + 1}] Status: ${order.status}`)
      console.log(`       Amount: ${order.amount}`)
      console.log(`       Type: ${order.order_type}`)
      console.log(`       Created: ${order.created_at}`)
    })
  } else {
    console.log('沒有支付訂單記錄')
  }

  console.log()

  // 8. 檢查 payment_mandates（定期定額授權）
  console.log('=== 檢查定期定額授權 ===')
  const { data: mandates } = await supabase
    .from('payment_mandates')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (mandates && mandates.length > 0) {
    console.log(`找到 ${mandates.length} 筆授權記錄:`)
    mandates.forEach((mandate, i) => {
      console.log(`\n   [${i + 1}] Status: ${mandate.status}`)
      console.log(`       Plan ID: ${mandate.plan_id}`)
      console.log(`       Created: ${mandate.created_at}`)
      if (mandate.status === 'active') {
        console.log(`       ⚠️  還有 active 的定期定額授權！`)
      }
    })
  } else {
    console.log('沒有定期定額授權記錄')
  }

  console.log()

  // 9. 總結問題
  console.log('=== 診斷結論 ===')
  const issues: string[] = []

  if (companyAdmin && !companyAdmin.subscription_period) {
    issues.push('❌ companies.subscription_period 欄位為 null 或不存在')
  }

  if (allSubs && allSubs.filter(s => s.status === 'active').length > 1) {
    issues.push('❌ 存在多個 active 訂閱記錄')
  }

  if (allSubs && allSubs.some(s => s.status === 'active' && (s.subscription_plans as any)?.slug !== 'free')) {
    issues.push('❌ active 訂閱不是 FREE 方案（應該是降級未完成）')
  }

  if (mandates && mandates.some(m => m.status === 'active')) {
    issues.push('❌ 還有 active 的定期定額授權（應該取消）')
  }

  if (issues.length === 0) {
    console.log('✅ 沒有發現明顯問題')
    console.log('\n可能的原因：')
    console.log('1. API 查詢使用的是 authClient（有 RLS），而診斷使用 admin client')
    console.log('2. 購買流程的查詢參數有誤')
    console.log('3. 前端傳遞的 planId 不存在')
  } else {
    console.log('發現以下問題：')
    issues.forEach(issue => console.log(issue))
  }
}

diagnosePurchaseFlow().catch(console.error)
