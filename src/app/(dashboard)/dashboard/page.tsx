import { getUser, getUserCompanies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/dashboard/stat-card'
import { TokenBalanceCard } from '@/components/dashboard/TokenBalanceCard'
import { UpgradePromptCard } from '@/components/dashboard/UpgradePromptCard'
import { FileText, Globe, TrendingUp } from 'lucide-react'
import { checkPagePermission, getUserSubscriptionTier } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  await checkPagePermission('canAccessDashboard')

  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const companies = await getUserCompanies(user.id)
  const subscriptionTier = await getUserSubscriptionTier()

  // 取得 token 餘額
  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  let tokenBalance = 0
  if (membership) {
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('monthly_quota_balance, purchased_token_balance')
      .eq('company_id', membership.company_id)
      .eq('status', 'active')
      .single()

    if (subscription) {
      tokenBalance = subscription.monthly_quota_balance + subscription.purchased_token_balance
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">儀表版</h1>
          <p className="text-muted-foreground mt-1">
            歡迎回來，{user.email}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="總文章數"
          value="24"
          icon={FileText}
          trend={{ value: 12.5, isPositive: true }}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          title="網站數量"
          value="3"
          icon={Globe}
          trend={{ value: 8.2, isPositive: true }}
          iconBgColor="bg-success/10"
          iconColor="text-success"
        />
        <TokenBalanceCard />
      </div>

      {/* 免費用戶升級提示 */}
      {subscriptionTier === 'free' && (
        <div className="mt-6">
          <UpgradePromptCard currentTier={subscriptionTier} tokenBalance={tokenBalance} />
        </div>
      )}

      <Card className="border-border/30 bg-muted/30 backdrop-blur-sm rounded-xl opacity-60">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-muted-foreground flex items-center gap-2">
            🚧 7 天流量趨勢
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">此功能正在開發中</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-muted-foreground/30">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">🚧 待開發</p>
              <p className="text-sm">近一週的網站訪問數據圖表即將推出</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
