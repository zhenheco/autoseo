import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateReferralCode } from '@/lib/referral'
import { cookies } from 'next/headers'

/**
 * 生成唯一的公司 slug
 */
function generateSlug(email: string): string {
  const username = email.split('@')[0]
  const random = Math.random().toString(36).substring(2, 8)
  return `${username}-${random}`
}

/**
 * 註冊新使用者並自動建立公司和訂閱
 */
export async function signUp(email: string, password: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // 1. 建立使用者帳號
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    },
  })

  if (authError) throw authError
  if (!authData.user) throw new Error('註冊失敗')

  console.log('[註冊] Step 1 完成: 使用者帳號建立成功', authData.user.id)

  // 2. 建立公司（使用 admin client 避免 RLS 限制）
  const { data: company, error: companyError} = await adminClient
    .from('companies')
    .insert({
      name: `${email.split('@')[0]} 的公司`,
      slug: generateSlug(email),
      owner_id: authData.user.id,
      subscription_tier: 'free',
    })
    .select()
    .single()

  if (companyError) {
    console.error('[註冊失敗] Step 2: 建立公司失敗', companyError)
    throw companyError
  }
  console.log('[註冊] Step 2 完成: 公司建立成功', company.id)

  // 3. 新增成員記錄（設定為 Owner）
  const { error: memberError } = await adminClient
    .from('company_members')
    .insert({
      company_id: company.id,
      user_id: authData.user.id,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

  if (memberError) {
    console.error('[註冊失敗] Step 3: 新增成員記錄失敗', memberError)
    throw memberError
  }
  console.log('[註冊] Step 3 完成: 成員記錄建立成功')

  // 4. 取得免費方案
  console.log('[註冊] Step 4: 查詢免費方案...')
  const { data: freePlan, error: planError } = await adminClient
    .from('subscription_plans')
    .select('id, base_tokens')
    .eq('slug', 'free')
    .single()

  if (planError || !freePlan) {
    console.error('[註冊失敗] Step 4: 無法取得免費方案', { planError, freePlan })
    throw new Error('免費方案設定錯誤')
  }
  console.log('[註冊] Step 4 完成: 免費方案查詢成功', freePlan)

  // 5. 建立免費訂閱（一次性給 10k tokens，不再每月重置）
  const { error: subscriptionError } = await adminClient
    .from('company_subscriptions')
    .insert({
      company_id: company.id,
      plan_id: freePlan.id,
      status: 'active',
      monthly_token_quota: 0, // 免費方案不使用月配額
      monthly_quota_balance: 0,
      purchased_token_balance: freePlan.base_tokens, // 一次性給 10,000 tokens
      current_period_start: null,
      current_period_end: null,
      is_lifetime: false,
      lifetime_discount: 1.0,
    })

  if (subscriptionError) {
    console.error('[註冊失敗] Step 5: 建立訂閱失敗', subscriptionError)
    throw subscriptionError
  }
  console.log('[註冊] Step 5 完成: 訂閱建立成功')

  // 6. 創建推薦碼
  let referralCode = generateReferralCode()

  // 確保推薦碼唯一
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await adminClient
      .from('company_referral_codes')
      .select('id')
      .eq('referral_code', referralCode)
      .single()

    if (!existing) break
    referralCode = generateReferralCode()
    attempts++
  }

  const { error: referralCodeError } = await adminClient
    .from('company_referral_codes')
    .insert({
      company_id: company.id,
      referral_code: referralCode,
    })

  if (referralCodeError) {
    console.error('創建推薦碼失敗:', referralCodeError)
  }

  // 7. 檢查是否有推薦人
  const cookieStore = await cookies()
  const referrerCode = cookieStore.get('referral_code')?.value

  if (referrerCode) {
    // 查找推薦人
    const { data: referrerData } = await adminClient
      .from('company_referral_codes')
      .select('company_id')
      .eq('referral_code', referrerCode)
      .single()

    if (referrerData) {
      // 創建推薦關係
      await adminClient
        .from('referrals')
        .insert({
          referrer_company_id: referrerData.company_id,
          referred_company_id: company.id,
          referral_code: referrerCode,
          status: 'pending', // 等待首次付款
        })

      // 更新推薦人的推薦統計 (使用 RPC 函數來原子性地增加計數)
      await adminClient.rpc('increment_referral_count', {
        p_company_id: referrerData.company_id
      })
    }
  }

  // 8. 也保留舊的 subscriptions 表記錄（向後兼容）
  await adminClient
    .from('subscriptions')
    .insert({
      company_id: company.id,
      plan_name: 'free',
      status: 'active',
      monthly_article_limit: 5,
      articles_used_this_month: 0,
      current_period_start: new Date().toISOString(),
      current_period_end: null,
    })

  return { user: authData.user, company }
}

/**
 * 登入
 */
export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error

  return data
}

/**
 * 登出
 */
export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) throw error
}

/**
 * 取得當前使用者
 */
export async function getUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

/**
 * 取得使用者的公司列表
 */
export async function getUserCompanies(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_members')
    .select('companies(*), role')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error

  return data
}

/**
 * 取得使用者的主要公司（第一個公司）
 */
export async function getUserPrimaryCompany(userId: string) {
  const companies = await getUserCompanies(userId)
  if (!companies || companies.length === 0) return null
  return (companies[0] as any).companies
}

/**
 * 取得公司的所有成員
 */
export async function getCompanyMembers(companyId: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: members, error } = await supabase
    .from('company_members')
    .select('id, user_id, role, status, joined_at')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })

  if (error) throw error

  if (!members) return []

  // 使用 Admin Client 存取 auth.users
  const userIds = members.map(m => m.user_id)
  const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers()

  if (usersError) {
    console.error('獲取使用者資料失敗:', usersError)
    return members.map(member => ({
      ...member,
      users: null
    }))
  }

  const membersWithUsers = members.map(member => {
    const user = users?.find((u: any) => u.id === member.user_id)
    return {
      ...member,
      users: user ? {
        id: user.id,
        email: user.email || ''
      } : null
    }
  })

  return membersWithUsers
}
