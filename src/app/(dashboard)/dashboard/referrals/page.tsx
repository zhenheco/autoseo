import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Gift, Link as LinkIcon, TrendingUp } from 'lucide-react'
import { ReferralLinkCard } from '@/components/referrals/ReferralLinkCard'
import { ReferralHistoryTable } from '@/components/referrals/ReferralHistoryTable'

export default async function ReferralsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()

  // 取得用戶的公司
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) {
    redirect('/dashboard')
  }

  // 取得推薦碼
  const { data: referralCode } = await supabase
    .from('company_referral_codes')
    .select('*')
    .eq('company_id', membership.company_id)
    .single()

  // 取得推薦統計
  const { data: referralStats } = await supabase
    .from('referrals')
    .select('status')
    .eq('referrer_company_id', membership.company_id)

  const pendingReferrals = referralStats?.filter(r => r.status === 'pending').length || 0
  const completedReferrals = referralStats?.filter(r => r.status === 'completed').length || 0
  const totalReferrals = referralStats?.length || 0

  // 取得推薦歷史
  const { data: referralHistory } = await supabase
    .from('referrals')
    .select(`
      *,
      referred_company:companies!referrals_referred_company_id_fkey(name)
    `)
    .eq('referrer_company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(20)

  // 取得獎勵記錄
  const { data: rewards } = await supabase
    .from('referral_rewards')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false})

  const totalRewardTokens = rewards?.reduce((sum, r) => sum + (r.token_amount || 0), 0) || 0

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* 標題 */}
      <div>
        <h1 className="text-3xl font-bold">推薦獎勵計畫</h1>
        <p className="text-muted-foreground mt-2">
          分享您的推薦連結，朋友註冊並付款後，您將獲得 50,000 tokens 獎勵
        </p>
      </div>

      {/* 推薦連結卡片 */}
      {referralCode && (
        <ReferralLinkCard referralCode={referralCode.referral_code} />
      )}

      {/* 統計卡片 */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總推薦數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">累計推薦朋友數</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功推薦</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{completedReferrals}</div>
            <p className="text-xs text-muted-foreground">已付款並獲得獎勵</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待付款</CardTitle>
            <LinkIcon className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingReferrals}</div>
            <p className="text-xs text-muted-foreground">等待首次付款</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">累計獎勵</CardTitle>
            <Gift className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalRewardTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">tokens 獎勵總額</p>
          </CardContent>
        </Card>
      </div>

      {/* 推薦歷史 */}
      <Card>
        <CardHeader>
          <CardTitle>推薦記錄</CardTitle>
          <CardDescription>查看您的推薦朋友和獎勵狀態</CardDescription>
        </CardHeader>
        <CardContent>
          {referralHistory && referralHistory.length > 0 ? (
            <ReferralHistoryTable referrals={referralHistory} />
          ) : (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">還沒有推薦記錄</h3>
              <p className="text-sm text-muted-foreground mt-2">
                分享您的推薦連結，開始賺取獎勵吧！
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 獎勵規則說明 */}
      <Card>
        <CardHeader>
          <CardTitle>獎勵規則</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              1
            </div>
            <div>
              <h4 className="font-semibold">分享推薦連結</h4>
              <p className="text-sm text-muted-foreground">複製您的專屬推薦連結，分享給朋友</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              2
            </div>
            <div>
              <h4 className="font-semibold">朋友註冊帳號</h4>
              <p className="text-sm text-muted-foreground">朋友通過您的連結註冊，系統會自動記錄推薦關係</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success font-bold">
              3
            </div>
            <div>
              <h4 className="font-semibold">獲得獎勵</h4>
              <p className="text-sm text-muted-foreground">
                朋友完成首次付款後，您將立即獲得 <span className="font-bold text-primary">50,000 tokens</span> 獎勵
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
