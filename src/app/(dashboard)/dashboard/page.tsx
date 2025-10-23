import { getUser, getUserCompanies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const companies = await getUserCompanies(user.id)

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          歡迎回來，{user.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>您的公司</CardTitle>
            <CardDescription>管理您所屬的組織</CardDescription>
          </CardHeader>
          <CardContent>
            {companies && companies.length > 0 ? (
              <div className="space-y-2">
                {companies.map((member: any) => (
                  <div key={member.companies.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{member.companies.name}</p>
                      <p className="text-sm text-muted-foreground">
                        角色: {member.role}
                      </p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {member.companies.subscription_tier}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">尚未加入任何公司</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速開始</CardTitle>
            <CardDescription>開始使用平台功能</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <p className="font-medium">新增 WordPress 網站</p>
                <p className="text-sm text-muted-foreground">連接您的第一個網站</p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <p className="font-medium">生成文章</p>
                <p className="text-sm text-muted-foreground">開始自動生成 SEO 文章</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>訂閱狀態</CardTitle>
            <CardDescription>當前方案資訊</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">方案</span>
                <span className="font-medium">
                  {companies && companies.length > 0
                    ? (companies[0] as any).companies.subscription_tier.toUpperCase()
                    : 'FREE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">本月額度</span>
                <span className="font-medium">0 / 5 篇</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>最近的文章</CardTitle>
            <CardDescription>查看您最近生成的文章</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              還沒有任何文章，開始生成您的第一篇文章吧！
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
