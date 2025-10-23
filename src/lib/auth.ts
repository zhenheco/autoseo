import { createClient } from '@/lib/supabase/server'

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

  // 1. 建立使用者帳號
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (authError) throw authError
  if (!authData.user) throw new Error('註冊失敗')

  // 2. 建立公司
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: `${email.split('@')[0]} 的公司`,
      slug: generateSlug(email),
      owner_id: authData.user.id,
      subscription_tier: 'free',
    })
    .select()
    .single()

  if (companyError) throw companyError

  // 3. 新增成員記錄（設定為 Owner）
  const { error: memberError } = await supabase
    .from('company_members')
    .insert({
      company_id: company.id,
      user_id: authData.user.id,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

  if (memberError) throw memberError

  // 4. 建立免費訂閱
  const periodStart = new Date()
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + 30)

  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .insert({
      company_id: company.id,
      plan_name: 'free',
      status: 'active',
      monthly_article_limit: 5,
      articles_used_this_month: 0,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })

  if (subscriptionError) throw subscriptionError

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

  const { data, error } = await supabase
    .from('company_members')
    .select(`
      *,
      users:user_id (
        email
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })

  if (error) throw error

  return data
}
