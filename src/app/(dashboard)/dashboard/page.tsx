import { getUser, getUserCompanies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Rocket, TrendingUp, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const companies = await getUserCompanies(user.id)

  const hasAgencyPlan = companies?.some(
    (member: any) => member.companies.subscription_tier === 'agency'
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-12 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground/80 mt-1">
                歡迎回來，<span className="text-foreground/60">{user.email}</span>
              </p>
            </div>
          </div>
        </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {hasAgencyPlan && (
          <Card className="group border-muted/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/5 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">您的公司</CardTitle>
                  <CardDescription className="text-xs">管理您所屬的組織</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {companies && companies.length > 0 ? (
                <div className="space-y-3">
                  {companies.map((member: any) => (
                    <a
                      key={member.companies.id}
                      href={`/dashboard/companies/${member.companies.id}/websites`}
                      className="group/item flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-accent/50 hover:border-primary/30 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover/item:text-primary transition-colors truncate">
                          {member.companies.name}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {member.role}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary border-0">
                          {member.companies.subscription_tier.toUpperCase()}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover/item:text-primary group-hover/item:translate-x-0.5 transition-all" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground/60">尚未加入任何公司</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="group border-muted/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 flex items-center justify-center">
                <Rocket className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-lg">快速開始</CardTitle>
                <CardDescription className="text-xs">開始使用平台功能</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <a
              href="/dashboard/getting-started"
              className="group/link flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-gradient-to-br from-background/50 to-accent/20 hover:from-accent/50 hover:to-accent/30 hover:border-primary/30 cursor-pointer transition-all duration-200"
            >
              <div className="flex-1">
                <p className="font-semibold text-foreground/90 group-hover/link:text-primary transition-colors mb-1">
                  查看完整設定指南
                </p>
                <p className="text-xs text-muted-foreground/60">
                  一步步引導您完成網站設定到文章生成
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground/40 group-hover/link:text-primary group-hover/link:translate-x-1 transition-all" />
            </a>
          </CardContent>
        </Card>

        <Card className="border-muted/40 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/5 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-lg">訂閱狀態</CardTitle>
                <CardDescription className="text-xs">當前方案資訊</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                <span className="text-sm text-muted-foreground/80">方案</span>
                <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/20">
                  {companies && companies.length > 0
                    ? (companies[0] as any).companies.subscription_tier.toUpperCase()
                    : 'FREE'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                <span className="text-sm text-muted-foreground/80">本月額度</span>
                <span className="font-semibold text-foreground/90">0 / 5 篇</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12">
        <Card className="border-muted/40 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-2xl font-bold">最近的文章</CardTitle>
              <CardDescription className="text-sm mt-2">查看您最近生成的文章</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-muted-foreground/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground/90 mb-2">還沒有任何文章</h3>
              <p className="text-sm text-muted-foreground/60 text-center max-w-sm mb-6">
                開始生成您的第一篇文章，讓 AI 幫助您創作高品質的 SEO 內容
              </p>
              <a href="/dashboard/articles/generate">
                <button className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
                  <Rocket className="h-4 w-4" />
                  開始生成文章
                </button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
