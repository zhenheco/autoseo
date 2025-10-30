import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requireOwnerRole() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership, error } = await supabase
    .from('company_members')
    .select('role, company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (error || !membership || membership.role !== 'owner') {
    redirect('/dashboard')
  }

  return { user, companyId: membership.company_id }
}
