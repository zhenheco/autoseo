import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type UserRole = 'owner' | 'admin' | 'editor' | 'writer' | 'viewer'

export interface RolePermissions {
  canAccessDashboard: boolean
  canAccessArticles: boolean
  canAccessWebsites: boolean
  canAccessSubscription: boolean
  canAccessSettings: boolean
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    canAccessDashboard: true,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: true,
    canAccessSettings: true,
  },
  admin: {
    canAccessDashboard: true,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: true,
    canAccessSettings: true,
  },
  editor: {
    canAccessDashboard: true,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: false,
    canAccessSettings: false,
  },
  writer: {
    canAccessDashboard: false,
    canAccessArticles: true,
    canAccessWebsites: false,
    canAccessSubscription: false,
    canAccessSettings: false,
  },
  viewer: {
    canAccessDashboard: false,
    canAccessArticles: true,
    canAccessWebsites: false,
    canAccessSubscription: false,
    canAccessSettings: false,
  },
}

export async function getUserRole(): Promise<UserRole | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  return (membership?.role as UserRole) || null
}

export async function checkPagePermission(page: keyof RolePermissions): Promise<void> {
  const role = await getUserRole()

  if (!role) {
    redirect('/login')
  }

  const permissions = ROLE_PERMISSIONS[role]

  if (!permissions[page]) {
    redirect('/dashboard/unauthorized')
  }

  // 額外檢查：免費用戶不能訪問網站功能
  if (page === 'canAccessWebsites') {
    const hasWebsiteAccess = await canAccessWebsitesFeature()
    if (!hasWebsiteAccess) {
      redirect('/dashboard/unauthorized?reason=free-plan')
    }
  }
}

/**
 * 檢查用戶是否可以訪問網站連接功能
 * 免費方案不允許連接網站
 */
export async function canAccessWebsitesFeature(): Promise<boolean> {
  const user = await getUser()
  if (!user) return false

  const supabase = await createClient()

  // 取得用戶的公司
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return false

  // 檢查公司的訂閱層級
  const { data: company } = await supabase
    .from('companies')
    .select('subscription_tier')
    .eq('id', membership.company_id)
    .single()

  // 免費方案不能連接網站
  return company?.subscription_tier !== 'free'
}

/**
 * 取得用戶的訂閱層級
 */
export async function getUserSubscriptionTier(): Promise<'free' | 'basic' | 'pro' | 'enterprise' | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return null

  const { data: company } = await supabase
    .from('companies')
    .select('subscription_tier')
    .eq('id', membership.company_id)
    .single()

  return company?.subscription_tier || null
}
