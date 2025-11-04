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

async function debugMandate() {
  try {
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users.users.find(u => u.email === 'ace@zhenhe-co.com')

    if (!user) {
      console.error('找不到用戶')
      process.exit(1)
    }

    const { data: companyMember } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!companyMember) {
      console.error('找不到公司')
      process.exit(1)
    }

    const companyId = companyMember.company_id

    // 查詢所有 mandates（包括 cancelled）
    const { data: allMandates } = await supabase
      .from('recurring_mandates')
      .select('id, mandate_no, status, period_type, subscription_plan_id, subscription_plans(slug, name, is_lifetime), created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    console.log('\n=== 所有定期定額委託 ===')
    if (allMandates && allMandates.length > 0) {
      allMandates.forEach((mandate, index) => {
        const plan = (mandate as any).subscription_plans
        console.log(`\n${index + 1}. Mandate ${mandate.mandate_no}`)
        console.log('   ID:', mandate.id)
        console.log('   Status:', mandate.status)
        console.log('   Plan:', plan?.name || 'N/A')
        console.log('   Plan Slug:', plan?.slug || 'N/A')
        console.log('   Period Type:', mandate.period_type)
        console.log('   Is Lifetime:', plan?.is_lifetime ? '是' : '否')
        console.log('   Created:', new Date(mandate.created_at).toLocaleString('zh-TW'))
      })
    } else {
      console.log('沒有任何定期定額委託記錄')
    }

    // 查詢最後一個訂單的 mandate
    const { data: lastOrder } = await supabase
      .from('payment_orders')
      .select('mandate_id')
      .eq('company_id', companyId)
      .eq('order_type', 'recurring_first')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastOrder && lastOrder.mandate_id) {
      console.log('\n=== 最後一個成功訂單的 Mandate ===')
      const { data: mandate } = await supabase
        .from('recurring_mandates')
        .select('id, mandate_no, status, period_type, subscription_plan_id, subscription_plans(slug, name, is_lifetime)')
        .eq('id', lastOrder.mandate_id)
        .single()

      if (mandate) {
        const plan = (mandate as any).subscription_plans
        console.log('Mandate No:', mandate.mandate_no)
        console.log('Status:', mandate.status)
        console.log('Plan:', plan?.name || 'N/A')
        console.log('Plan Slug:', plan?.slug || 'N/A')
        console.log('Period Type:', mandate.period_type)
      }
    }

  } catch (error) {
    console.error('檢查失敗:', error)
    process.exit(1)
  }
}

debugMandate()
