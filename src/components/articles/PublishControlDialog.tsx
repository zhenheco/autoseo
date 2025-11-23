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
import { Info } from 'lucide-react'
import { WebsiteSelector } from './WebsiteSelector'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface PublishControlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleId: string
  currentStatus: string
  onPublishSuccess: () => void
}

export function PublishControlDialog({
  open,
  onOpenChange,
  articleId,
  currentStatus,
  onPublishSuccess,
}: PublishControlDialogProps) {
  const [websiteId, setWebsiteId] = useState<string | null>(null)
  const [websiteName, setWebsiteName] = useState<string | null>(null)
  const [articleWebsiteId, setArticleWebsiteId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>(currentStatus || 'draft')
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [scheduledTime, setScheduledTime] = useState<string>('12:00')
  const [isPublishing, setIsPublishing] = useState(false)

  useEffect(() => {
    async function fetchArticleWebsite() {
      if (!articleId) return

      const supabase = createClient()
      const { data, error } = await supabase
        .from('articles')
        .select('website_id')
        .eq('id', articleId)
        .single()

      if (!error && data?.website_id) {
        setArticleWebsiteId(data.website_id)
      }
    }

    if (open) {
      fetchArticleWebsite()
    }
  }, [articleId, open])

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

  const handlePublishNow = async () => {
    if (!websiteId) {
      toast.error('請選擇目標網站')
      return
    }

    setIsPublishing(true)
    try {
      const res = await fetch(`/api/articles/${articleId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: 'wordpress',
          website_id: websiteId,
          status,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '發布失敗')
      }

      toast.success('發布成功！文章已成功發布到 WordPress')
      onPublishSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error('發布失敗: ' + (error instanceof Error ? error.message : '未知錯誤'))
    } finally {
      setIsPublishing(false)
    }
  }

  const handleSchedule = async () => {
    if (!scheduledDate) {
      alert('請選擇排程發布日期')
      return
    }

    const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`)

    if (scheduleDateTime <= new Date()) {
      alert('排程時間必須是未來的時間')
      return
    }

    setIsPublishing(true)
    try {
      const res = await fetch(`/api/articles/${articleId}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduled_time: scheduleDateTime.toISOString(),
          auto_publish: true,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '設定排程失敗')
      }

      alert(`排程成功！文章將於 ${scheduledDate} ${scheduledTime} 自動發布`)
      onPublishSuccess()
      onOpenChange(false)
    } catch (error) {
      alert('設定排程失敗: ' + (error instanceof Error ? error.message : '未知錯誤'))
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>發布設定</DialogTitle>
          <DialogDescription>
            選擇發布目標和時間設定
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="website">目標網站</Label>
            <WebsiteSelector
              value={websiteId}
              onChange={setWebsiteId}
              placeholder="選擇網站"
              articleWebsiteId={articleWebsiteId}
            />
          </div>
          {websiteId && websiteName && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                文章將發布至：<span className="font-medium">{websiteName}</span>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="target">發布目標</Label>
            <Select defaultValue="wordpress">
              <SelectTrigger id="target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wordpress">WordPress</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">發布狀態</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="pending">待審核</SelectItem>
                <SelectItem value="published">已發布</SelectItem>
                <SelectItem value="scheduled">已排程</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === 'scheduled' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="date">排程日期</Label>
                <input
                  id="date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="time">排程時間</Label>
                <input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          {status === 'scheduled' ? (
            <Button onClick={handleSchedule} disabled={isPublishing}>
              {isPublishing ? '設定中...' : '設定排程'}
            </Button>
          ) : (
            <Button onClick={handlePublishNow} disabled={isPublishing}>
              {isPublishing ? '發布中...' : '立即發布'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
