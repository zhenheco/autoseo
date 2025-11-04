import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkUserSubscription() {
  try {
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users.users.find(u => u.email === 'ace@zhenhe-co.com')

    if (!user) {
      console.error('找不到用戶')
      process.exit(1)
    }

    console.log('\n=== 用戶資訊 ===')
    console.log('Email:', user.email)
    console.log('User ID:', user.id)

    const { data: companyMember } = await supabase
      .from('company_members')
      .select('company_id, companies(id, name, subscription_tier, seo_token_balance)')
      .eq('user_id', user.id)
      .single()

    if (!companyMember) {
      console.error('找不到公司')
      process.exit(1)
    }

    const company = (companyMember as any).companies
    console.log('\n=== 公司資訊 ===')
    console.log('Company ID:', company.id)
    console.log('Company Name:', company.name)
    console.log('Subscription Tier:', company.subscription_tier)
    console.log('Token Balance:', company.seo_token_balance)

    const { data: mandates } = await supabase
      .from('recurring_mandates')
      .select('id, mandate_no, status, period_type, subscription_plan_id, subscription_plans(slug, name, is_lifetime)')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(5)

    console.log('\n=== 定期定額委託 ===')
    if (mandates && mandates.length > 0) {
      mandates.forEach((mandate, index) => {
        const plan = (mandate as any).subscription_plans
        console.log(`\n${index + 1}. Mandate ${mandate.mandate_no}`)
        console.log('   Status:', mandate.status)
        console.log('   Plan:', plan?.name || 'N/A')
        console.log('   Plan Slug:', plan?.slug || 'N/A')
        console.log('   Period Type:', mandate.period_type === 'M' ? '月繳' : mandate.period_type === 'Y' ? '年繳' : mandate.period_type)
        console.log('   Is Lifetime:', plan?.is_lifetime ? '是' : '否')
      })
    } else {
      console.log('沒有定期定額委託')
    }

    const { data: orders } = await supabase
      .from('payment_orders')
      .select('id, order_no, order_type, status, amount, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(5)

    console.log('\n=== 最近訂單 ===')
    if (orders && orders.length > 0) {
      orders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ${order.order_no}`)
        console.log('   Type:', order.order_type)
        console.log('   Status:', order.status)
        console.log('   Amount:', order.amount)
        console.log('   Created:', new Date(order.created_at).toLocaleString('zh-TW'))
      })
    } else {
      console.log('沒有訂單記錄')
    }

  } catch (error) {
    console.error('檢查失敗:', error)
    process.exit(1)
  }
}

checkUserSubscription()
