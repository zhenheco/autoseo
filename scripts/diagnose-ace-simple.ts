import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// 載入環境變數
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少環境變數：')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function diagnose() {
  console.log('=== 診斷 ace@zhenhe-co.com 帳號狀態 ===\n')

  // 1. 檢查 auth.users
  console.log('1. 檢查 auth.users 記錄...')
  const { data: users } = await supabase.auth.admin.listUsers()
  const aceUser = users?.users.find(u => u.email === 'ace@zhenhe-co.com')

  if (!aceUser) {
    console.log('❌ 找不到 ace@zhenhe-co.com 用戶')
    return
  }

  console.log('✅ 用戶存在')
  console.log(`   User ID: ${aceUser.id}`)
  console.log(`   Email: ${aceUser.email}`)
  console.log(`   Created: ${aceUser.created_at}\n`)

  // 2. 檢查 company_members
  console.log('2. 檢查 company_members 記錄...')
  const { data: members, error: membersError } = await supabase
    .from('company_members')
    .select('*')
    .eq('user_id', aceUser.id)

  if (membersError) {
    console.log(`❌ 查詢錯誤: ${membersError.message}`)
    return
  }

  if (!members || members.length === 0) {
    console.log('❌ 找不到 company_members 記錄')
    return
  }

  console.log(`✅ 找到 ${members.length} 筆 company_members 記錄`)
  members.forEach((m, i) => {
    console.log(`   [${i + 1}] Company ID: ${m.company_id}`)
    console.log(`       Role: ${m.role}`)
    console.log(`       Status: ${m.status}`)
  })
  console.log()

  const companyId = members[0].company_id

  // 3. 檢查 companies
  console.log('3. 檢查 companies 表資料...')
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (companyError) {
    console.log(`❌ 查詢錯誤: ${companyError.message}`)
    console.log(`   Company ID: ${companyId}`)
    return
  }

  if (!company) {
    console.log('❌ 找不到 companies 記錄')
    console.log(`   Company ID: ${companyId}`)
    return
  }

  console.log('✅ 公司資料存在')
  console.log(`   Company ID: ${company.id}`)
  console.log(`   名稱: ${company.name}`)
  console.log(`   訂閱層級: ${company.subscription_tier}`)
  console.log(`   Created: ${company.created_at}\n`)

  // 4. 檢查 company_subscriptions
  console.log('4. 檢查 company_subscriptions 記錄...')
  const { data: subscriptions, error: subsError } = await supabase
    .from('company_subscriptions')
    .select('*, subscription_plans(name, slug)')
    .eq('company_id', companyId)

  if (subsError) {
    console.log(`❌ 查詢錯誤: ${subsError.message}`)
    return
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('❌ 找不到 company_subscriptions 記錄')
    return
  }

  console.log(`✅ 找到 ${subscriptions.length} 筆訂閱記錄`)
  subscriptions.forEach((s, i) => {
    console.log(`   [${i + 1}] Status: ${s.status}`)
    console.log(`       Plan: ${(s.subscription_plans as any)?.name || 'N/A'}`)
    console.log(`       月配額: ${s.monthly_token_quota}`)
    console.log(`       月餘額: ${s.monthly_quota_balance}`)
    console.log(`       購買餘額: ${s.purchased_token_balance}`)
    console.log(`       總餘額: ${s.monthly_quota_balance + s.purchased_token_balance}`)
    console.log(`       週期: ${s.current_period_start} ~ ${s.current_period_end}`)
  })
  console.log()

  // 5. 診斷結果
  console.log('=== 診斷結果 ===\n')

  const activeSub = subscriptions.find(s => s.status === 'active')

  if (!activeSub) {
    console.log('⚠️  沒有 active 狀態的訂閱')
    return
  }

  // 檢查 Token 餘額
  const isFree = activeSub.monthly_token_quota === 0
  if (isFree) {
    console.log('✅ 方案類型：免費方案 (monthly_token_quota = 0)')

    if (activeSub.purchased_token_balance === 10000) {
      console.log('✅ Token 餘額正確：10,000')
    } else {
      console.log(`❌ Token 餘額錯誤：${activeSub.purchased_token_balance}（應為 10,000）`)
    }
  } else {
    console.log(`✅ 方案類型：付費方案 (monthly_token_quota = ${activeSub.monthly_token_quota})`)
    console.log(`   月配額餘額: ${activeSub.monthly_quota_balance}`)
    console.log(`   購買餘額: ${activeSub.purchased_token_balance}`)
    console.log(`   總餘額: ${activeSub.monthly_quota_balance + activeSub.purchased_token_balance}`)
  }

  // 檢查資料完整性
  console.log('\n=== 資料完整性檢查 ===')
  const issues: string[] = []

  if (!aceUser) issues.push('❌ auth.users 記錄缺失')
  if (!members || members.length === 0) issues.push('❌ company_members 記錄缺失')
  if (!company) issues.push('❌ companies 記錄缺失')
  if (!subscriptions || subscriptions.length === 0) issues.push('❌ company_subscriptions 記錄缺失')
  if (subscriptions && subscriptions.filter(s => s.status === 'active').length > 1) {
    issues.push('⚠️  存在多個 active 訂閱記錄')
  }

  if (issues.length === 0) {
    console.log('✅ 所有必要資料都存在，「找不到公司資料」問題不是因為資料缺失')
  } else {
    console.log('❌ 發現以下問題：')
    issues.forEach(issue => console.log(`   ${issue}`))
  }
}

diagnose().catch(console.error)
