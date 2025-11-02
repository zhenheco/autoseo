import { getUser, getUserPrimaryCompany } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, Calendar, Package, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'
import { PaymentStatusChecker } from '@/components/billing/PaymentStatusChecker'

type PaymentOrder = Database['public']['Tables']['payment_orders']['Row']
type Subscription = Database['public']['Tables']['company_subscriptions']['Row']

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; subscription?: string; error?: string; orderNo?: string }>
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const company = await getUserPrimaryCompany(user.id)

  if (!company) {
    redirect('/dashboard/getting-started')
  }

  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .single()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">計費中心</h1>
          <p className="text-muted-foreground mt-1">
            管理您的訂閱和付款記錄
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          <Package className="mr-2 h-4 w-4" />
          查看方案
        </Link>
      </div>

      <PaymentStatusChecker />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              目前訂閱
            </CardTitle>
            <CardDescription>您的訂閱計劃詳情</CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">方案類型</span>
                  <span className="font-semibold">{subscription.plan_type || '未知'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">狀態</span>
                  <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500">
                    {subscription.status === 'active' ? '啟用中' : subscription.status}
                  </span>
                </div>
                {subscription.current_period_end && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">到期日</span>
                    <span className="font-semibold">
                      {new Date(subscription.current_period_end).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                )}
                {subscription.token_balance !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Token 餘額</span>
                    <span className="font-semibold">{subscription.token_balance.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">您尚未訂閱任何方案</p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                >
                  選擇方案
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              使用統計
            </CardTitle>
            <CardDescription>本月使用情況</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">已生成文章</span>
                <span className="font-semibold">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Token 使用量</span>
                <span className="font-semibold">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API 呼叫次數</span>
                <span className="font-semibold">0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl">
        <CardHeader>
          <CardTitle>付款記錄</CardTitle>
          <CardDescription>您的付款交易歷史</CardDescription>
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order: PaymentOrder) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      order.status === 'success' ? 'bg-green-500/10' :
                      order.status === 'pending' ? 'bg-yellow-500/10' :
                      'bg-red-500/10'
                    }`}>
                      {order.status === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : order.status === 'pending' ? (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{order.item_description || '訂單'}</p>
                      <p className="text-sm text-muted-foreground">
                        訂單編號：{order.order_no}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.created_at && new Date(order.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">NT$ {order.amount.toLocaleString()}</p>
                    <p className={`text-sm ${
                      order.status === 'success' ? 'text-green-500' :
                      order.status === 'pending' ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                      {order.status === 'success' ? '已完成' :
                       order.status === 'pending' ? '處理中' :
                       order.status === 'failed' ? '失敗' :
                       order.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">尚無付款記錄</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
