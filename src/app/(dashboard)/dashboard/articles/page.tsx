'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArticleGenerationButtonsWrapper } from '@/components/articles/ArticleGenerationButtonsWrapper'
import { Loader2, CheckCircle2, Clock, FileText } from 'lucide-react'

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
  html_content?: string | null
}

interface ArticleJob {
  id: string
  keywords: string[]
  status: string
  created_at: string
  metadata?: {
    title?: string
  }
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [jobs, setJobs] = useState<ArticleJob[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [articlesRes, jobsRes] = await Promise.all([
        fetch('/api/articles'),
        fetch('/api/articles/jobs'),
      ])

      if (articlesRes.ok) {
        const data = await articlesRes.json()
        setArticles(data.articles || [])
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)

    const handleArticlesUpdated = () => {
      fetchData()
    }

    window.addEventListener('articlesUpdated', handleArticlesUpdated)

    return () => {
      clearInterval(interval)
      window.removeEventListener('articlesUpdated', handleArticlesUpdated)
    }
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <span className="text-red-600">✗</span>
      case 'pending':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const combinedItems = [
    ...jobs.map(job => ({
      type: 'job' as const,
      id: job.id,
      keyword: job.keywords[0] || '',
      title: job.metadata?.title || job.keywords.join(', '),
      displayTitle: job.metadata?.title
        ? `${job.keywords[0] || ''} - ${job.metadata.title}`
        : job.keywords.join(', '),
      status: job.status,
      created_at: job.created_at,
    })),
    ...articles.map(article => ({
      type: 'article' as const,
      id: article.id,
      keyword: '',
      title: article.title || '未命名文章',
      displayTitle: article.title || '未命名文章',
      status: 'completed',
      created_at: article.created_at,
      article,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="h-screen flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">文章管理</h1>
            <p className="text-sm text-muted-foreground">
              共 {articles.length} 篇文章，{jobs.length} 個任務進行中
            </p>
          </div>
          <ArticleGenerationButtonsWrapper />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r overflow-y-auto">
          <Card className="rounded-none border-0 shadow-none">
            <CardHeader>
              <CardTitle>所有文章</CardTitle>
              <CardDescription>
                點擊文章查看預覽
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : combinedItems.length > 0 ? (
                <div className="space-y-2">
                  {combinedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.type === 'article' && item.article) {
                          setSelectedArticle(item.article)
                        }
                      }}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedArticle?.id === item.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getStatusIcon(item.status)}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{item.displayTitle}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(item.created_at).toLocaleString('zh-TW')}
                          </p>
                          {item.type === 'article' && item.article && (
                            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                              <span>字數: {item.article.word_count || 0}</span>
                              <span>閱讀: {item.article.reading_time || 0} 分鐘</span>
                              {item.article.quality_score && (
                                <span>品質: {item.article.quality_score}分</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-4">還沒有任何文章</p>
                  <p className="text-sm text-muted-foreground">
                    點擊右上角的「批次文章生成」開始創建文章
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="w-1/2 overflow-y-auto bg-muted/30">
          {selectedArticle ? (
            <div className="p-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">
                    {selectedArticle.title || '未命名文章'}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>字數: {selectedArticle.word_count || 0}</span>
                    <span>閱讀時間: {selectedArticle.reading_time || 0} 分鐘</span>
                    {selectedArticle.quality_score && (
                      <span>品質分數: {selectedArticle.quality_score}分</span>
                    )}
                  </div>
                  {selectedArticle.wordpress_post_url && (
                    <a
                      href={selectedArticle.wordpress_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3"
                    >
                      <Button variant="outline" size="sm">
                        查看已發布文章
                      </Button>
                    </a>
                  )}
                </div>

                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: selectedArticle.html_content || '<p>內容載入中...</p>',
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">選擇左側文章以查看預覽</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
