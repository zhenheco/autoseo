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

async function checkOrders() {
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

  const { data: orders } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  console.log('\n=== 所有訂單 ===')
  if (orders && orders.length > 0) {
    orders.forEach((order, idx) => {
      console.log(`\n${idx + 1}. 訂單 ${order.order_no}`)
      console.log('   類型:', order.order_type)
      console.log('   狀態:', order.status)
      console.log('   金額:', order.amount)
      console.log('   Mandate ID:', order.mandate_id)
      console.log('   建立時間:', new Date(order.created_at).toLocaleString('zh-TW'))
    })
  } else {
    console.log('沒有任何訂單記錄')
  }
}

checkOrders()
