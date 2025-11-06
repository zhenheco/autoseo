import { getUser, getUserPrimaryCompany } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { checkPagePermission } from '@/lib/permissions'
import { ArrowLeft, ExternalLink, FileText, Clock, BarChart3, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface Article {
  id: string
  title: string | null
  slug: string | null
  status: string
  quality_score: number | null
  word_count: number | null
  reading_time: number | null
  wordpress_post_url: string | null
  created_at: string
  published_at: string | null
  excerpt: string | null
  keywords: string[] | null
}

async function getWebsite(websiteId: string, companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('website_configs')
    .select('*')
    .eq('id', websiteId)
    .eq('company_id', companyId)
    .single()

  if (error) {
    console.error('Error fetching website:', error)
    return null
  }

  return data
}

async function getWebsiteArticles(websiteId: string, companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title, slug, status, quality_score, word_count, reading_time, wordpress_post_url, created_at, published_at, excerpt, keywords')
    .eq('website_id', websiteId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching articles:', error)
    return []
  }

  return data as Article[]
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    generated: { label: '已生成', variant: 'secondary' },
    reviewed: { label: '已審核', variant: 'default' },
    published: { label: '已發布', variant: 'default' },
    archived: { label: '已封存', variant: 'outline' }
  }

  const config = statusMap[status] || { label: status, variant: 'secondary' }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export default async function WebsiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await checkPagePermission('canAccessWebsites')

  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const company = await getUserPrimaryCompany(user.id)
  if (!company) {
    redirect('/dashboard')
  }

  const { id } = await params
  const website = await getWebsite(id, company.id)

  if (!website) {
    redirect('/dashboard/websites?error=網站不存在或無權訪問')
  }

  const articles = await getWebsiteArticles(id, company.id)

  // 統計資訊
  const totalArticles = articles.length
  const publishedArticles = articles.filter(a => a.status === 'published').length
  const totalWords = articles.reduce((sum, a) => sum + (a.word_count || 0), 0)
  const avgQualityScore = articles.length > 0
    ? (articles.reduce((sum, a) => sum + (a.quality_score || 0), 0) / articles.length).toFixed(1)
    : '0'

  return (
    <div className="container mx-auto p-8">
      {/* 返回按鈕 */}
      <Link href="/dashboard/websites">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回網站列表
        </Button>
      </Link>

      {/* 網站資訊卡片 */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">
                {website.site_name || website.website_name}
              </CardTitle>
              <CardDescription className="mt-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <a
                  href={website.site_url || website.wordpress_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {website.site_url || website.wordpress_url}
                </a>
              </CardDescription>
            </div>
            <Badge variant={website.is_active ? 'default' : 'secondary'}>
              {website.is_active ? '啟用中' : '已停用'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalArticles}</p>
                <p className="text-sm text-muted-foreground">總文章數</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ExternalLink className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{publishedArticles}</p>
                <p className="text-sm text-muted-foreground">已發布</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{totalWords.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">總字數</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{avgQualityScore}</p>
                <p className="text-sm text-muted-foreground">平均質量分數</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 文章列表 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">文章列表</h2>
        <Link href="/dashboard/articles/new">
          <Button>新增文章</Button>
        </Link>
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">此網站尚無文章</p>
            <Link href="/dashboard/articles/new">
              <Button>生成第一篇文章</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <Card key={article.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {article.title || '未命名文章'}
                    </CardTitle>
                    {article.excerpt && (
                      <CardDescription className="mt-2 line-clamp-2">
                        {article.excerpt}
                      </CardDescription>
                    )}
                    {article.keywords && article.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {article.keywords.slice(0, 5).map((keyword, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    {getStatusBadge(article.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{article.word_count?.toLocaleString() || 0} 字</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{article.reading_time || 0} 分鐘閱讀</span>
                    </div>
                    {article.quality_score !== null && (
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span>質量: {article.quality_score.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(article.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {article.wordpress_post_url && (
                      <a
                        href={article.wordpress_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          查看發布
                        </Button>
                      </a>
                    )}
                    <Link href={`/dashboard/articles/${article.id}/preview`}>
                      <Button variant="outline" size="sm">
                        預覽
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
