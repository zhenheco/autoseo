import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { PlusCircle, Globe, CheckCircle, XCircle, Calendar, Settings, FileText, ArrowLeft, TrendingUp } from 'lucide-react'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CompanyWebsitesPage({ params }: PageProps) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const resolvedParams = await params
  const companyId = resolvedParams.id

  const supabase = await createClient()

  const { data: memberData, error: memberError } = await supabase
    .from('company_members')
    .select('role, companies(name, subscription_tier)')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (memberError || !memberData) {
    redirect('/dashboard')
  }

  const company = memberData.companies as { name: string; subscription_tier: string }

  const { data: websites, error: websitesError } = await supabase
    .from('website_configs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-12">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-6 group/back">
              <ArrowLeft className="h-4 w-4 mr-2 group-hover/back:-translate-x-0.5 transition-transform" />
              返回儀表板
            </Button>
          </Link>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight">{company.name}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-muted-foreground/80">管理 WordPress 網站</p>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold">
                    {company.subscription_tier.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
            <Link href="/dashboard/websites/new">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/10">
                <PlusCircle className="h-5 w-5" />
                新增網站
              </Button>
            </Link>
          </div>
        </div>

        {websites && websites.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {websites.map((website) => (
              <Card key={website.id} className="group border-muted/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                      website.is_active
                        ? 'bg-gradient-to-br from-green-500/20 to-green-600/5'
                        : 'bg-gradient-to-br from-red-500/20 to-red-600/5'
                    }`}>
                      <Globe className={`h-6 w-6 ${website.is_active ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                    {website.is_active ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" />
                        已啟用
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        已停用
                      </Badge>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                      {website.name}
                    </CardTitle>
                    <CardDescription className="text-sm break-all line-clamp-2">
                      {website.wordpress_url}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-end space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground/60" />
                      <div>
                        <p className="text-xs text-muted-foreground/60">建立時間</p>
                        <p className="text-sm font-medium text-foreground/90">
                          {new Date(website.created_at).toLocaleDateString('zh-TW', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
                      <div>
                        <p className="text-xs text-muted-foreground/60">文章數</p>
                        <p className="text-sm font-medium text-foreground/90">0</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/dashboard/websites/${website.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full group/btn bg-background/50 hover:bg-accent/50 hover:border-primary/30">
                        <Settings className="h-4 w-4 mr-2 group-hover/btn:rotate-90 transition-transform duration-300" />
                        管理
                      </Button>
                    </Link>
                    <Link href={`/dashboard/websites/${website.id}/articles`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full group/btn bg-background/50 hover:bg-accent/50 hover:border-primary/30">
                        <FileText className="h-4 w-4 mr-2" />
                        文章
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-muted/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-20 px-4">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center mb-6">
                <Globe className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground/90">還沒有網站</h3>
              <p className="text-muted-foreground/60 text-center max-w-md mb-8">
                開始新增您的第一個 WordPress 網站，讓 AI 幫助您自動生成高品質的 SEO 文章
              </p>
              <Link href="/dashboard/websites/new">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/10">
                  <PlusCircle className="h-5 w-5" />
                  新增網站
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
