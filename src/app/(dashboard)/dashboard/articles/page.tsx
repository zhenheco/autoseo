import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ArticleGenerationButtonsWrapper } from '@/components/articles/ArticleGenerationButtonsWrapper'

export const dynamic = 'force-dynamic'

async function getArticles(userId: string, userRole: string) {
  const supabase = createAdminClient()

  let query = supabase
    .from('generated_articles')
    .select(`
      id,
      title,
      slug,
      status,
      quality_score,
      word_count,
      reading_time,
      wordpress_post_url,
      created_at,
      published_at,
      created_by
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (userRole === 'writer' || userRole === 'viewer') {
    query = query.eq('created_by', userId)
  }

  const { data, error } = await query

  if (error) {
    console.error('獲取文章失敗:', error)
    return []
  }

  return data || []
}

export default async function ArticlesPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const userRole = membership?.role || 'viewer'
  const articles = await getArticles(user.id, userRole)

  const canCreateArticle = ['owner', 'admin', 'editor', 'writer'].includes(userRole)

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">文章管理</h1>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {userRole === 'writer' || userRole === 'viewer'
              ? '您的文章列表'
              : '管理您的 SEO 文章和發布狀態'}
          </p>
          {canCreateArticle && (
            <ArticleGenerationButtonsWrapper />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {userRole === 'writer' || userRole === 'viewer' ? '我的文章' : '所有文章'}
          </CardTitle>
          <CardDescription>共 {articles.length} 篇文章</CardDescription>
        </CardHeader>
        <CardContent>
          {articles && articles.length > 0 ? (
            <div className="divide-y">
              {articles.map((article) => (
                <div key={article.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{article.title || '未命名文章'}</h3>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>字數: {article.word_count || 0}</span>
                        <span>閱讀時間: {article.reading_time || 0} 分鐘</span>
                        {article.quality_score && (
                          <span>品質: {article.quality_score}分</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        建立時間: {new Date(article.created_at).toLocaleString('zh-TW')}
                      </p>
                      {article.published_at && (
                        <p className="text-xs text-muted-foreground">
                          發布時間: {new Date(article.published_at).toLocaleString('zh-TW')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${
                          article.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : article.status === 'reviewed'
                            ? 'bg-blue-100 text-blue-700'
                            : article.status === 'archived'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {article.status === 'published' && '已發布'}
                        {article.status === 'reviewed' && '已審核'}
                        {article.status === 'generated' && '已生成'}
                        {article.status === 'archived' && '已封存'}
                      </span>
                      <Link href={`/dashboard/articles/${article.id}/preview`}>
                        <Button variant="outline" size="sm">
                          預覽
                        </Button>
                      </Link>
                      {article.wordpress_post_url && (
                        <a
                          href={article.wordpress_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            查看發布
                          </Button>
                        </a>
                      )}
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
