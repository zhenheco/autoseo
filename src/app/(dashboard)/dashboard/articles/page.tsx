'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ArticleStatusIcon } from '@/components/articles/ArticleStatusIcon'
import { ArticleSplitView } from '@/components/articles/ArticleSplitView'
import { InlineHtmlEditor } from '@/components/articles/InlineHtmlEditor'
import { PublishControlDialog } from '@/components/articles/PublishControlDialog'
import { BatchPublishDialog } from '@/components/articles/BatchPublishDialog'
import { Loader2, FileText, Trash2 } from 'lucide-react'
import { ArticleListItem } from '@/types/article.types'
import { toast } from 'sonner'
import 'allotment/dist/style.css'
import '@/styles/allotment-custom.css'

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
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [jobs, setJobs] = useState<ArticleJob[]>([])
  const [selectedArticle, setSelectedArticle] = useState<ArticleListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [batchPublishDialogOpen, setBatchPublishDialogOpen] = useState(false)

  const fetchData = async (retryCount = 0) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = 10000

    try {
      const [articlesRes, jobsRes] = await Promise.all([
        fetch('/api/articles'),
        fetch('/api/articles/jobs'),
      ])

      if (articlesRes.status === 500 && retryCount < MAX_RETRIES) {
        console.warn(`500 error fetching articles, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        setTimeout(() => fetchData(retryCount + 1), RETRY_DELAY)
        return
      }

      if (jobsRes.status === 500 && retryCount < MAX_RETRIES) {
        console.warn(`500 error fetching jobs, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        setTimeout(() => fetchData(retryCount + 1), RETRY_DELAY)
        return
      }

      if (articlesRes.ok) {
        const data = await articlesRes.json()
        setArticles(data.articles || [])
      } else if (articlesRes.status !== 500) {
        console.error('Failed to fetch articles:', articlesRes.status)
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json()
        setJobs(data.jobs || [])
      } else if (jobsRes.status !== 500) {
        console.error('Failed to fetch jobs:', jobsRes.status)
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Network error, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`, error)
        setTimeout(() => fetchData(retryCount + 1), RETRY_DELAY)
        return
      }
      console.error('Failed to fetch data after retries:', error)
    } finally {
      if (retryCount === 0) {
        setLoading(false)
      }
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

  const combinedItems = [
    ...jobs.map(job => ({
      type: 'job' as const,
      id: job.id,
      title: job.metadata?.title || job.keywords.join(', '),
      status: job.status,
      created_at: job.created_at,
    })),
    ...articles.map(article => ({
      type: 'article' as const,
      id: article.id,
      title: article.title || '未命名文章',
      status: 'completed',
      created_at: article.created_at,
      article,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    const allArticleIds = articles.map(a => a.id)
    setSelectedItems(new Set(allArticleIds))
  }

  const handleDeselectAll = () => {
    setSelectedItems(new Set())
  }

  const handleDeleteItem = async (item: typeof combinedItems[0], e: React.MouseEvent) => {
    e.stopPropagation()

    const itemType = item.type === 'job' ? '任務' : '文章'
    if (!confirm(`確定要刪除這個${itemType}嗎？`)) {
      return
    }

    try {
      const endpoint = item.type === 'job'
        ? `/api/articles/jobs/${item.id}`
        : `/api/articles/${item.id}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
      })

      if (response.ok) {
        if (selectedArticle?.id === item.id) {
          setSelectedArticle(null)
        }
        await fetchData()
        toast.success('刪除成功')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(`刪除失敗: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Delete item error:', error)
      toast.error(`刪除失敗: ${(error as Error).message}`)
    }
  }

  const handleSaveArticle = async (html: string, title: string, contentJson?: object) => {
    if (!selectedArticle) return

    const response = await fetch(`/api/articles/${selectedArticle.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html_content: html,
        title,
        content_json: contentJson,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '儲存失敗')
    }

    await fetchData()
  }

  const handlePublishArticle = (article: ArticleListItem) => {
    setPublishDialogOpen(true)
  }

  const handleBatchPublish = () => {
    if (selectedItems.size === 0) {
      toast.error('請選擇至少一篇文章')
      return
    }
    setBatchPublishDialogOpen(true)
  }

  const selectedArticlesForBatch = articles.filter(a => selectedItems.has(a.id))

  const leftPane = (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b flex-shrink-0">
        {selectedItems.size > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              已選取 {selectedItems.size} 篇文章
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleDeselectAll}>
                取消選取
              </Button>
              <Button size="sm" onClick={handleBatchPublish}>
                批次發布
              </Button>
            </div>
          </div>
        )}
        {selectedItems.size === 0 && articles.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleSelectAll}>
            全選文章
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
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
                  if (item.type === 'article' && 'article' in item && item.article) {
                    setSelectedArticle(item.article)
                  }
                }}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  item.type === 'article' && 'article' in item && selectedArticle?.id === item.article?.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {item.type === 'article' && (
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => handleToggleItem(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold truncate">{item.title}</h3>
                      <ArticleStatusIcon
                        status={item.status}
                        scheduledAt={item.type === 'article' && 'article' in item ? item.article?.published_at : null}
                      />
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{new Date(item.created_at).toLocaleDateString('zh-TW')}</span>
                      {item.type === 'article' && item.article && (
                        <>
                          <span>字數: {item.article.word_count || 0}</span>
                          {item.article.quality_score && (
                            <span>品質: {item.article.quality_score}分</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteItem(item, e)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
      </div>
    </div>
  )

  const rightPane = (
    <InlineHtmlEditor
      article={selectedArticle}
      onSave={handleSaveArticle}
      onPublish={handlePublishArticle}
    />
  )

  return (
    <>
      <div className="h-screen flex flex-col">
        <ArticleSplitView leftPane={leftPane} rightPane={rightPane} />
      </div>

      <PublishControlDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        articleId={selectedArticle?.id || ''}
        currentStatus={selectedArticle?.status || 'draft'}
        onPublishSuccess={() => {
          fetchData()
          setPublishDialogOpen(false)
        }}
      />

      <BatchPublishDialog
        open={batchPublishDialogOpen}
        onOpenChange={setBatchPublishDialogOpen}
        articles={selectedArticlesForBatch}
        onPublishSuccess={() => {
          fetchData()
          setSelectedItems(new Set())
          setBatchPublishDialogOpen(false)
        }}
      />
    </>
  )
}
