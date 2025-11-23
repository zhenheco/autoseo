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

async function checkOwnership() {
  console.log('=== 檢查 ace@zhenhe-co.com 的公司擁有權 ===\n')

  // 取得用戶
  const { data: users } = await supabase.auth.admin.listUsers()
  const aceUser = users?.users.find(u => u.email === 'ace@zhenhe-co.com')

  if (!aceUser) {
    console.log('❌ 找不到用戶')
    return
  }

  console.log(`User ID: ${aceUser.id}\n`)

  // 取得 company_members
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', aceUser.id)
    .single()

  if (!membership) {
    console.log('❌ 找不到 company_members 記錄')
    return
  }

  console.log(`Company ID: ${membership.company_id}`)
  console.log(`Role: ${membership.role}\n`)

  // 取得 companies（使用 admin client，繞過 RLS）
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, owner_id')
    .eq('id', membership.company_id)
    .single()

  if (!company) {
    console.log('❌ 找不到公司記錄')
    return
  }

  console.log(`公司名稱: ${company.name}`)
  console.log(`Owner ID: ${company.owner_id}`)
  console.log(`User ID:  ${aceUser.id}\n`)

  // 比對
  if (company.owner_id === aceUser.id) {
    console.log('✅ 用戶是 owner（RLS 政策應該允許查詢）')
  } else {
    console.log('❌ 用戶不是 owner（RLS 政策會阻擋查詢）')
    console.log('\n這就是「找不到公司資料」的原因！')
    console.log('RLS 政策只允許 owner_id = auth.uid() 查看公司')
    console.log('但用戶只是 company_members 中的成員')
  }

  // 測試用戶身份查詢（模擬 RLS）
  console.log('\n=== 模擬用戶身份查詢（有 RLS 限制）===')

  // 建立用戶身份的 client（模擬前端）
  const { data: { session } } = await supabase.auth.admin.createSession({
    user_id: aceUser.id,
    session_not_after: new Date(Date.now() + 60000).toISOString()
  })

  if (session) {
    const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    })

    const { data: userCompany, error } = await userClient
      .from('companies')
      .select('subscription_tier, subscription_period')
      .eq('id', membership.company_id)
      .single()

    if (error) {
      console.log(`❌ 查詢失敗: ${error.message}`)
      console.log(`   Error code: ${error.code}`)
    } else if (!userCompany) {
      console.log('❌ 回傳 null（RLS 阻擋）')
    } else {
      console.log('✅ 查詢成功')
      console.log(userCompany)
    }
  }
}

checkOwnership().catch(console.error)
