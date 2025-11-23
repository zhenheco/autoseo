import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TokenBillingService } from '@/lib/billing/token-billing-service'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: companyMember } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!companyMember) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  const billingService = new TokenBillingService(supabase)
  const balance = await billingService.getCurrentBalance(companyMember.company_id)

  return NextResponse.json(balance)
}
