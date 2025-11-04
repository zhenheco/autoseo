import { getUser, getUserCompanies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/dashboard/stat-card'
import { FileText, Globe, TrendingUp, DollarSign, Users, ArrowUpRight } from 'lucide-react'
import { checkPagePermission } from '@/lib/permissions'

export default async function DashboardPage() {
  await checkPagePermission('canAccessDashboard')

  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const companies = await getUserCompanies(user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            歡迎回來，{user.email}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
        <StatCard
          title="月流量"
          value="15.2K"
          icon={TrendingUp}
          trend={{ value: 23.1, isPositive: true }}
          iconBgColor="bg-secondary/10"
          iconColor="text-secondary"
        />
        <StatCard
          title="轉換率"
          value="3.24%"
          icon={DollarSign}
          trend={{ value: -2.4, isPositive: false }}
          iconBgColor="bg-warning/10"
          iconColor="text-warning"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl card-hover-lift hover:shadow-xl hover:border-primary/50 transition-all">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">7 天流量趨勢</CardTitle>
            <CardDescription className="text-base">近一週的網站訪問數據</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground glass-effect rounded-xl">
              <p className="text-base">圖表組件將在此顯示</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl card-hover-lift hover:shadow-xl hover:border-primary/50 transition-all">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">最近活動</CardTitle>
                <CardDescription className="text-base">您的最新操作記錄</CardDescription>
              </div>
              <a
                href="/dashboard/activity"
                className="text-base text-primary hover:text-primary/80 font-semibold flex items-center gap-1 transition-all hover:gap-2"
              >
                查看全部
                <ArrowUpRight className="h-5 w-5" />
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  action: '生成新文章',
                  title: 'Next.js 14 最佳實踐指南',
                  time: '2 小時前',
                  status: 'success',
                },
                {
                  action: '更新網站',
                  title: '技術部落格',
                  time: '5 小時前',
                  status: 'info',
                },
                {
                  action: '發布文章',
                  title: 'React Server Components 深入解析',
                  time: '1 天前',
                  status: 'success',
                },
              ].map((activity, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 rounded-xl hover:bg-accent/50 transition-all duration-200 hover:translate-x-1"
                >
                  <div className="mt-1.5">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        activity.status === 'success'
                          ? 'bg-success'
                          : 'bg-primary'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground">
                      {activity.action}
                    </p>
                    <p className="text-base text-muted-foreground truncate mt-1">
                      {activity.title}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl card-hover-lift hover:shadow-xl hover:border-primary/50 transition-all">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">快速操作</CardTitle>
          <CardDescription className="text-base">常用功能快捷入口</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: '生成文章',
                description: '使用 AI 創建 SEO 文章',
                href: '/dashboard/articles/generate',
                icon: FileText,
              },
              {
                title: '管理網站',
                description: '新增或編輯網站',
                href: '/dashboard/websites',
                icon: Globe,
              },
              {
                title: '查看分析',
                description: '檢視流量數據',
                href: '/dashboard/analytics',
                icon: TrendingUp,
              },
              {
                title: '團隊管理',
                description: '邀請成員協作',
                href: '/dashboard/team',
                icon: Users,
              },
            ].map((action) => (
              <a
                key={action.title}
                href={action.href}
                className="flex flex-col gap-3 p-5 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all duration-300 group card-hover-lift"
              >
                <action.icon className="h-6 w-6 text-primary group-hover:scale-125 transition-transform duration-300" />
                <div>
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    {action.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
