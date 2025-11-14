import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArticleHtmlPreview } from '@/components/article/ArticleHtmlPreview'

async function getArticle(articleId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('id', articleId)
    .single()

  if (error) {
    console.error('獲取文章失敗:', error)
    return null
  }

  return data
}

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    redirect('/dashboard/articles')
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{article.title}</h1>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>字數: {article.word_count || 0}</span>
            <span>閱讀時間: {article.reading_time || 0} 分鐘</span>
            {article.quality_score && (
              <span>品質分數: {article.quality_score}/100</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/articles">
            <Button variant="outline">返回列表</Button>
          </Link>
          {article.wordpress_post_url && (
            <a href={article.wordpress_post_url} target="_blank" rel="noopener noreferrer">
              <Button>查看已發布文章</Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>SEO 元數據</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm font-medium">SEO 標題</span>
              <p className="text-sm text-muted-foreground">{article.seo_title || article.title}</p>
            </div>
            <div>
              <span className="text-sm font-medium">SEO 描述</span>
              <p className="text-sm text-muted-foreground">{article.seo_description || '無'}</p>
            </div>
            <div>
              <span className="text-sm font-medium">網址 Slug</span>
              <p className="text-sm text-muted-foreground">{article.slug || '無'}</p>
            </div>
            <div>
              <span className="text-sm font-medium">主要關鍵字</span>
              <p className="text-sm text-muted-foreground">{article.focus_keyword || '無'}</p>
            </div>
            {article.keywords && article.keywords.length > 0 && (
              <div>
                <span className="text-sm font-medium">相關關鍵字</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {article.keywords.map((keyword: string, index: number) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 bg-gray-100 rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {article.featured_image_url && (
          <Card>
            <CardHeader>
              <CardTitle>特色圖片</CardTitle>
              <CardDescription>此圖片已包含在文章 HTML 內容中</CardDescription>
            </CardHeader>
            <CardContent>
              <Image
                src={article.featured_image_url}
                alt={article.featured_image_alt || article.title}
                width={1024}
                height={1024}
                className="w-full max-w-2xl rounded-lg"
                unoptimized={article.featured_image_url.includes('drive.google.com')}
              />
              {article.featured_image_alt && (
                <p className="text-sm text-muted-foreground mt-2">
                  Alt 文字: {article.featured_image_alt}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>文章內容</CardTitle>
            <CardDescription>HTML 預覽（已啟用安全性淨化）</CardDescription>
          </CardHeader>
          <CardContent>
            <ArticleHtmlPreview htmlContent={article.html_content} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Markdown 原始碼</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">
              {article.markdown_content}
            </pre>
          </CardContent>
        </Card>

        {article.categories && article.categories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>分類與標籤</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium">分類</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {article.categories.map((category: string, index: number) => (
                    <span
                      key={index}
                      className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
              {article.tags && article.tags.length > 0 && (
                <div>
                  <span className="text-sm font-medium">標籤</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {article.tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 bg-gray-100 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {article.internal_links && article.internal_links.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>內部連結</CardTitle>
              <CardDescription>共 {article.internal_links_count || 0} 個內部連結</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {article.internal_links.map((link: { anchor: string; url: string }, index: number) => (
                  <li key={index} className="text-sm">
                    <span className="font-medium">{link.anchor}</span>
                    <span className="text-muted-foreground"> → {link.url}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>文章統計</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{article.word_count || 0}</div>
              <div className="text-xs text-muted-foreground">總字數</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{article.reading_time || 0}</div>
              <div className="text-xs text-muted-foreground">閱讀分鐘數</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{article.paragraph_count || 0}</div>
              <div className="text-xs text-muted-foreground">段落數</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{article.sentence_count || 0}</div>
              <div className="text-xs text-muted-foreground">句子數</div>
            </div>
          </CardContent>
        </Card>

        {article.flesch_reading_ease && (
          <Card>
            <CardHeader>
              <CardTitle>可讀性指標</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-lg font-bold">{article.flesch_reading_ease.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Flesch 閱讀容易度</div>
              </div>
              <div>
                <div className="text-lg font-bold">{article.flesch_kincaid_grade.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">FK 年級程度</div>
              </div>
              <div>
                <div className="text-lg font-bold">{article.gunning_fog_index.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Gunning Fog 指數</div>
              </div>
            </CardContent>
          </Card>
        )}

        {article.research_model && (
          <Card>
            <CardHeader>
              <CardTitle>AI 模型資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Research:</span>
                <span className="font-medium">{article.research_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Strategy:</span>
                <span className="font-medium">{article.strategy_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Writing:</span>
                <span className="font-medium">{article.writing_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meta:</span>
                <span className="font-medium">{article.meta_model}</span>
              </div>
              {article.generation_time && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">生成時間:</span>
                  <span className="font-medium">{(article.generation_time / 1000).toFixed(2)} 秒</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
