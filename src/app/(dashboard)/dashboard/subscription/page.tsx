import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionPlans } from './subscription-plans'
import { SubscriptionStatusChecker } from '@/components/subscription/SubscriptionStatusChecker'
import type { Database } from '@/types/database.types'

export default async function SubscriptionPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    redirect('/dashboard')
  }

  const { data: company } = await supabase
    .from('companies')
    .select<'*', Database['public']['Tables']['companies']['Row']>('*')
    .eq('id', member.company_id)
    .single()

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
    .eq('is_active', true)
    .eq('is_recurring', true)
    .order('monthly_price', { ascending: true })

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">訂閱方案</h1>
        <p className="text-muted-foreground mt-2">
          選擇適合您的訂閱方案
        </p>
      </div>

      <SubscriptionStatusChecker />

      {company && (
        <div className="mb-8 p-4 rounded-lg bg-muted">
          <h2 className="font-semibold mb-2">目前方案</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">方案類型</p>
              <p className="font-medium">{company.subscription_tier === 'free' ? '免費方案' : company.subscription_tier.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Token 餘額</p>
              <p className="font-medium">{company.seo_token_balance?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">到期日</p>
              <p className="font-medium">
                {company.subscription_ends_at
                  ? new Date(company.subscription_ends_at).toLocaleDateString('zh-TW')
                  : '無'}
              </p>
            </div>
          </div>
        </div>
      )}

      <SubscriptionPlans
        plans={plans || []}
        companyId={member.company_id}
        userEmail={user.email || ''}
        currentTier={company?.subscription_tier || 'free'}
      />
    </div>
  )
}
