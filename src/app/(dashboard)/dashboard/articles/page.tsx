import { getUser, getUserPrimaryCompany } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

async function getCompanyArticles(companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('article_jobs')
    .select(`
      *,
      website_configs (
        site_name,
        site_url
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return data
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string }
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const company = await getUserPrimaryCompany(user.id)

  if (!company) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">您尚未加入任何公司</p>
      </div>
    )
  }

  const articles = await getCompanyArticles(company.id)

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">文章管理</h1>
          <p className="text-muted-foreground mt-2">
            管理您的 SEO 文章和發布狀態
          </p>
        </div>
        <Link href="/dashboard/articles/new">
          <Button>生成新文章</Button>
        </Link>
      </div>

      {/* 訊息顯示 */}
      {searchParams.error && (
        <div className="mb-6 rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {searchParams.error}
        </div>
      )}
      {searchParams.success && (
        <div className="mb-6 rounded-md bg-green-500/15 p-4 text-sm text-green-700">
          {searchParams.success}
        </div>
      )}

      {/* 文章列表 */}
      <Card>
        <CardHeader>
          <CardTitle>所有文章</CardTitle>
          <CardDescription>查看和管理您的文章</CardDescription>
        </CardHeader>
        <CardContent>
          {articles && articles.length > 0 ? (
            <div className="divide-y">
              {articles.map((article: any) => (
                <div key={article.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{article.article_title || '未命名文章'}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        網站: {article.website_configs?.site_name || '未知'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        建立時間: {new Date(article.created_at).toLocaleString('zh-TW')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${
                          article.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : article.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : article.status === 'processing'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {article.status === 'published' && '已發布'}
                        {article.status === 'failed' && '失敗'}
                        {article.status === 'processing' && '處理中'}
                        {article.status === 'draft' && '草稿'}
                        {article.status === 'pending' && '待處理'}
                      </span>
                      <Link href={`/dashboard/articles/${article.id}`}>
                        <Button variant="outline" size="sm">
                          查看
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">還沒有任何文章</p>
              <Link href="/dashboard/articles/new">
                <Button>生成第一篇文章</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
