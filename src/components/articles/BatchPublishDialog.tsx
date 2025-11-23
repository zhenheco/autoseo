'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2 } from 'lucide-react'
import { WebsiteSelector } from './WebsiteSelector'
import { toast } from 'sonner'
import { ArticleListItem } from '@/types/article.types'
import { createClient } from '@/lib/supabase/client'

interface BatchPublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: ArticleListItem[]
  onPublishSuccess: () => void
}

export function BatchPublishDialog({
  open,
  onOpenChange,
  articles,
  onPublishSuccess,
}: BatchPublishDialogProps) {
  const [websiteId, setWebsiteId] = useState<string | null>(null)
  const [websiteName, setWebsiteName] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('publish')
  const [isPublishing, setIsPublishing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState<{
    total: number
    success: number
    failed: number
  } | null>(null)

  useEffect(() => {
    async function fetchWebsiteName() {
      if (!websiteId) {
        setWebsiteName(null)
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_configs')
        .select('website_name')
        .eq('id', websiteId)
        .single()

      if (!error && data) {
        setWebsiteName(data.website_name)
      }
    }

    fetchWebsiteName()
  }, [websiteId])

  const handleBatchPublish = async () => {
    if (!websiteId) {
      toast.error('請選擇目標網站')
      return
    }

    setIsPublishing(true)
    setProgress(0)
    setStats(null)

    try {
      const articleIds = articles.map((a) => a.id)

      const res = await fetch('/api/articles/batch-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_ids: articleIds,
          website_id: websiteId,
          target: 'wordpress',
          status,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '批次發布失敗')
      }

      const data = await res.json()
      setStats(data.stats)
      setProgress(100)

      if (data.stats.failed === 0) {
        toast.success(`成功發布 ${data.stats.success} 篇文章`)
      } else {
        toast.warning(
          `發布完成：成功 ${data.stats.success} 篇，失敗 ${data.stats.failed} 篇`
        )
      }

      onPublishSuccess()
    } catch (error) {
      toast.error('批次發布失敗: ' + (error instanceof Error ? error.message : '未知錯誤'))
    } finally {
      setIsPublishing(false)
    }
  }

  const handleClose = () => {
    if (!isPublishing) {
      setStats(null)
      setProgress(0)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>批次發布文章（{articles.length} 篇）</DialogTitle>
          <DialogDescription>
            將選中的文章發布到指定網站
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>選中的文章</Label>
            <div className="max-h-[200px] overflow-y-auto rounded-md border p-3">
              <ul className="space-y-1">
                {articles.map((article) => (
                  <li key={article.id} className="text-sm">
                    • {article.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">目標網站</Label>
            <WebsiteSelector
              value={websiteId}
              onChange={setWebsiteId}
              placeholder="選擇網站"
              disabled={isPublishing}
            />
          </div>
          {websiteId && websiteName && !isPublishing && !stats && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                確定要將 {articles.length} 篇文章發布到「<span className="font-medium">{websiteName}</span>」嗎？
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="status">發布狀態</Label>
            <Select value={status} onValueChange={setStatus} disabled={isPublishing}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="publish">已發布</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isPublishing && (
            <div className="grid gap-2">
              <Label>發布進度</Label>
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  發布中...
                </span>
              </div>
            </div>
          )}
          {stats && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">發布結果</p>
              <div className="mt-2 space-y-1 text-sm">
                <p>總共：{stats.total} 篇</p>
                <p className="text-green-600">成功：{stats.success} 篇</p>
                {stats.failed > 0 && (
                  <p className="text-red-600">失敗：{stats.failed} 篇</p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          {!stats ? (
            <Button onClick={handleBatchPublish} disabled={isPublishing || !websiteId}>
              {isPublishing ? '發布中...' : '開始批次發布'}
            </Button>
          ) : (
            <Button onClick={handleClose}>關閉</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
