import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionPlans } from './subscription-plans'
import { TokenPackages } from './token-packages'
import { PaymentHistory } from './payment-history'
import { SubscriptionStatusChecker } from '@/components/subscription/SubscriptionStatusChecker'
import type { Database } from '@/types/database.types'
import { checkPagePermission } from '@/lib/permissions'

export default async function SubscriptionPage() {
  await checkPagePermission('canAccessSubscription')

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

  // 從 company_subscriptions 表讀取訂閱資訊（包含 plan 資訊）
  const { data: companySubscription } = await supabase
    .from('company_subscriptions')
    .select('monthly_quota_balance, purchased_token_balance, monthly_token_quota, current_period_end, is_lifetime, subscription_plans(name, slug, billing_period)')
    .eq('company_id', member.company_id)
    .eq('status', 'active')
    .single()

  // 判斷是否為免費方案（使用 companies.subscription_tier 而非 monthly_token_quota）
  const isFree = company?.subscription_tier === 'free'

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
    .eq('is_active', true)
    .eq('is_lifetime', true)
    .neq('slug', 'free')
    .order('lifetime_price', { ascending: true })

  const { data: tokenPackages } = await supabase
    .from('token_packages')
    .select<'*', Database['public']['Tables']['token_packages']['Row']>('*')
    .eq('is_active', true)
    .order('price', { ascending: true })

  const { data: paymentOrders } = await supabase
    .from('payment_orders')
    .select<'*', Database['public']['Tables']['payment_orders']['Row']>('*')
    .eq('company_id', member.company_id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="container mx-auto p-8">
      <SubscriptionStatusChecker />

      {company && (
        <div className="mb-8 p-6 rounded-lg bg-gradient-to-br from-card to-muted border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">目前方案</h2>
            <a href="/pricing" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              升級方案
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">方案類型</p>
              <p className="text-lg font-semibold">
                {company.subscription_tier === 'free'
                  ? '免費方案'
                  : (companySubscription?.subscription_plans as { name?: string } | null)?.name || company.subscription_tier}
              </p>
            </div>
            {isFree ? (
              <>
                {/* 免費方案：顯示一次性 Token 餘額 */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">繳費類型</p>
                  <p className="text-lg font-semibold">-</p>
                  <p className="text-xs text-muted-foreground mt-1">免費方案</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Credit 餘額</p>
                  <p className="text-lg font-semibold">
                    {companySubscription?.purchased_token_balance?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">一次性配額</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">配額類型</p>
                  <p className="text-lg font-semibold">永不過期</p>
                  <p className="text-xs text-muted-foreground mt-1">免費方案</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">升級方案</p>
                  <a href="/pricing" className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm">
                    查看方案
                  </a>
                </div>
              </>
            ) : (
              <>
                {/* 付費方案：顯示月配額和購買 Token */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">繳費類型</p>
                  <p className="text-lg font-semibold">終身</p>
                  <p className="text-xs text-purple-600 mt-1">一次付清，永久使用</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">月配額</p>
                  <p className="text-lg font-semibold">
                    {companySubscription?.monthly_quota_balance?.toLocaleString() || 0} / {companySubscription?.monthly_token_quota?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">剩餘 / 總額</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">購買 Credit</p>
                  <p className="text-lg font-semibold">
                    {companySubscription?.purchased_token_balance?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-success mt-1">永不過期</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">配額重置日</p>
                  <p className="text-lg font-semibold">
                    {companySubscription?.current_period_end
                      ? new Date(companySubscription.current_period_end).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '永久'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">月配額每月重置</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div id="plans" className="mb-12">
        <SubscriptionPlans
          plans={plans || []}
          companyId={member.company_id}
          userEmail={user.email || ''}
          currentTier={company?.subscription_tier || 'free'}
        />
      </div>

      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Credit 包購買</h2>
        <TokenPackages packages={tokenPackages || []} companyId={member.company_id} userEmail={user.email || ''} />
      </div>

      <PaymentHistory orders={paymentOrders || []} />
    </div>
  )
}
