import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

async function getArticle(articleId: string) {
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
    .eq('id', articleId)
    .single()

  if (error) throw error

  return data
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    redirect('/dashboard/articles?error=' + encodeURIComponent('找不到該文章'))
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{article.article_title || '未命名文章'}</h1>
          <p className="text-muted-foreground mt-2">
            網站: {article.website_configs?.site_name}
          </p>
        </div>
        <Link href="/dashboard/articles">
          <Button variant="outline">
            返回
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        {/* 文章資訊 */}
        <Card>
          <CardHeader>
            <CardTitle>文章資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">狀態</span>
              <span
                className={`text-sm px-3 py-1 rounded-full ${
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
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">輸入方式</span>
              <span>
                {article.input_type === 'keyword' && '關鍵字'}
                {article.input_type === 'url' && 'URL'}
                {article.input_type === 'batch' && '批量'}
              </span>
            </div>

            {article.input_content && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">輸入內容</span>
                <span className="text-sm">
                  {article.input_content.keyword && article.input_content.keyword}
                  {article.input_content.url && (
                    <a
                      href={article.input_content.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {article.input_content.url}
                    </a>
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">建立時間</span>
              <span className="text-sm">
                {new Date(article.created_at).toLocaleString('zh-TW')}
              </span>
            </div>

            {article.published_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">發布時間</span>
                <span className="text-sm">
                  {new Date(article.published_at).toLocaleString('zh-TW')}
                </span>
              </div>
            )}

            {article.wp_post_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">WordPress ID</span>
                <span className="text-sm">{article.wp_post_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 文章內容 */}
        {article.generated_content && (
          <Card>
            <CardHeader>
              <CardTitle>生成內容</CardTitle>
              <CardDescription>AI 生成的文章內容預覽</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                {article.generated_content.title && (
                  <h2 className="text-2xl font-bold mb-4">{article.generated_content.title}</h2>
                )}
                {article.generated_content.content && (
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: article.generated_content.content }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 錯誤訊息 */}
        {article.error_message && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">錯誤訊息</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{article.error_message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
