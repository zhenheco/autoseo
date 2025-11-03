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

async function resetUserAccount() {
  try {
    // 1. 先查詢用戶 ID
    console.log('查詢用戶資訊...')
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) {
      console.error('查詢用戶失敗:', userError)
      process.exit(1)
    }

    const user = users.users.find(u => u.email === 'ace@zhenhe-co.com')
    if (!user) {
      console.error('找不到該用戶')
      process.exit(1)
    }

    console.log('找到用戶:', user.email, user.id)

    // 2. 查詢該用戶的公司
    const { data: companyMembers, error: memberError } = await supabase
      .from('company_members')
      .select('company_id, companies(id, name, subscription_tier)')
      .eq('user_id', user.id)
      .single()

    if (memberError) {
      console.error('查詢公司失敗:', memberError)
      process.exit(1)
    }

    const company = (companyMembers as any).companies
    console.log('找到公司:', company)

    // 2. 停用所有 active mandates
    console.log('\n停用所有 active mandates...')
    const { error: updateMandateError } = await supabase
      .from('recurring_mandates')
      .update({ status: 'terminated' })
      .eq('company_id', company.id)
      .eq('status', 'active')

    if (updateMandateError) {
      console.error('停用 mandate 失敗:', updateMandateError)
      process.exit(1)
    }
    console.log('✓ 成功停用 active mandates')

    // 3. 重置 company 的訂閱為 free，並將 token 歸零
    console.log('\n重置 company 訂閱為 free 並清空 token...')
    const { error: updateCompanyError } = await supabase
      .from('companies')
      .update({
        subscription_tier: 'free',
        subscription_ends_at: null,
        seo_token_balance: 0
      })
      .eq('id', company.id)

    if (updateCompanyError) {
      console.error('重置訂閱失敗:', updateCompanyError)
      process.exit(1)
    }
    console.log('✓ 成功重置訂閱為 free')

    // 4. 驗證結果
    console.log('\n驗證結果...')
    const { data: updatedCompany, error: verifyError } = await supabase
      .from('companies')
      .select('id, name, subscription_tier, subscription_ends_at')
      .eq('id', company.id)
      .single()

    if (verifyError) {
      console.error('驗證失敗:', verifyError)
      process.exit(1)
    }

    console.log('\n✓ 帳戶重置完成:')
    console.log(updatedCompany)
  } catch (error) {
    console.error('執行過程發生錯誤:', error)
    process.exit(1)
  }
}

resetUserAccount()
