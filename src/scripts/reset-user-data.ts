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

async function resetUserData() {
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

    console.log('\n=== 開始重置數據 ===')
    console.log('用戶:', user.email)
    console.log('公司 ID:', companyId)

    // 1. 刪除所有定期定額委託
    const { error: deleteMandatesError } = await supabase
      .from('recurring_mandates')
      .delete()
      .eq('company_id', companyId)

    if (deleteMandatesError) {
      console.error('刪除定期定額委託失敗:', deleteMandatesError)
    } else {
      console.log('✅ 刪除所有定期定額委託')
    }

    // 2. 刪除所有訂單
    const { error: deleteOrdersError } = await supabase
      .from('payment_orders')
      .delete()
      .eq('company_id', companyId)

    if (deleteOrdersError) {
      console.error('刪除訂單失敗:', deleteOrdersError)
    } else {
      console.log('✅ 刪除所有訂單')
    }

    // 3. 重置公司資料
    const { error: resetCompanyError } = await supabase
      .from('companies')
      .update({
        subscription_tier: 'free',
        subscription_ends_at: null,
        seo_token_balance: 0
      })
      .eq('id', companyId)

    if (resetCompanyError) {
      console.error('重置公司資料失敗:', resetCompanyError)
    } else {
      console.log('✅ 重置公司資料（tier: free, token: 0）')
    }

    console.log('\n=== 重置完成 ===')
    console.log('保留資料:')
    console.log('- 用戶帳號和密碼')
    console.log('- 公司基本資訊（名稱、slug）')
    console.log('')
    console.log('已刪除:')
    console.log('- 所有定期定額委託')
    console.log('- 所有訂單記錄')
    console.log('- 訂閱狀態和 Token 餘額')

  } catch (error) {
    console.error('重置失敗:', error)
    process.exit(1)
  }
}

resetUserData()
