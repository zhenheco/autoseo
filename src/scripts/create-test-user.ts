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

async function createTestUser() {
  try {
    const testEmail = 'test-upgrade@zhenhe-co.com'
    const testPassword = 'TestPassword123!'

    console.log('\n=== 建立測試用戶 ===')
    console.log('Email:', testEmail)

    // 1. 檢查用戶是否已存在
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === testEmail)

    let userId: string

    let companyId: string

    if (existingUser) {
      console.log('用戶已存在，使用現有用戶')
      userId = existingUser.id

      // 檢查是否有公司
      const { data: companyMember } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (companyMember) {
        companyId = companyMember.company_id

        // 停用所有 active mandates
        await supabase
          .from('recurring_mandates')
          .update({ status: 'cancelled' })
          .eq('company_id', companyId)
          .eq('status', 'active')

        console.log('已清理現有訂閱')
      } else {
        // 需要建立公司
        const companySlug = `test-upgrade-${Date.now()}`
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: '測試升級規則公司',
            slug: companySlug,
            subscription_tier: 'free',
            seo_token_balance: 0
          })
          .select()
          .single()

        if (companyError) {
          throw companyError
        }

        companyId = company.id
        console.log('✅ 公司建立成功:', companyId)

        // 建立公司成員關聯
        const { error: memberError } = await supabase
          .from('company_members')
          .insert({
            user_id: userId,
            company_id: companyId,
            role: 'owner'
          })

        if (memberError) {
          throw memberError
        }

        console.log('✅ 公司成員關聯建立成功')
      }
    } else {
      // 2. 建立新用戶
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
      })

      if (authError) {
        throw authError
      }

      userId = authData.user.id
      console.log('✅ 用戶建立成功:', userId)

      // 3. 建立公司
      const companySlug = `test-upgrade-${Date.now()}`
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: '測試升級規則公司',
          slug: companySlug,
          subscription_tier: 'free',
          seo_token_balance: 0
        })
        .select()
        .single()

      if (companyError) {
        throw companyError
      }

      companyId = company.id
      console.log('✅ 公司建立成功:', companyId)

      // 4. 建立公司成員關聯
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          user_id: userId,
          company_id: companyId,
          role: 'owner'
        })

      if (memberError) {
        throw memberError
      }

      console.log('✅ 公司成員關聯建立成功')
    }

    // 5. 查詢當前狀態
    const { data: member } = await supabase
      .from('company_members')
      .select('company_id, companies(id, name, subscription_tier)')
      .eq('user_id', userId)
      .single()

    const company = (member as any).companies

    console.log('\n=== 測試用戶狀態 ===')
    console.log('User ID:', userId)
    console.log('Company ID:', company.id)
    console.log('Company Name:', company.name)
    console.log('Subscription Tier:', company.subscription_tier)

    console.log('\n=== 測試用戶憑證 ===')
    console.log('Email:', testEmail)
    console.log('Password:', testPassword)
    console.log('\n✅ 測試用戶準備完成')

  } catch (error) {
    console.error('建立測試用戶失敗:', error)
    process.exit(1)
  }
}

createTestUser()
