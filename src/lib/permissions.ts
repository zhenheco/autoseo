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
}
