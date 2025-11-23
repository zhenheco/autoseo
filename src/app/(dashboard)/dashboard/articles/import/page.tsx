'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExcelUploadZone } from '@/components/articles/ExcelUploadZone'
import { PublishPlanTable } from '@/components/articles/PublishPlanTable'
import { ScheduleSettings } from '@/components/articles/ScheduleSettings'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export interface PublishPlan {
  id: string
  keyword: string
  websiteName: string
  websiteId?: string
  articleType?: string
  publishTime?: string
  customSlug?: string
  generatedTitle?: string
  generatedSlug?: string
  previewUrl?: string
  status: 'valid' | 'warning' | 'error'
  errorMessage?: string
}

export interface ScheduleConfig {
  mode: 'specific' | 'interval'
  intervalHours?: number
  startTime?: Date
}

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'schedule' | 'confirm'>('upload')
  const [publishPlans, setPublishPlans] = useState<PublishPlan[]>([])
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    mode: 'interval',
    intervalHours: 24
  })

  const handleFileUploaded = (plans: PublishPlan[]) => {
    setPublishPlans(plans)
    setStep('preview')
  }

  const handleScheduleNext = () => {
    setStep('confirm')
  }

  const handleConfirm = async () => {
    try {
      const response = await fetch('/api/articles/import-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: publishPlans, scheduleConfig })
      })

      if (!response.ok) {
        throw new Error('批次匯入失敗')
      }

      const result = await response.json()
      alert(`成功建立 ${result.created} 個任務`)
      window.location.href = '/dashboard/articles'
    } catch (error) {
      alert(error instanceof Error ? error.message : '發生錯誤')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/articles">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">批次匯入文章</h1>
          <p className="text-muted-foreground">上傳 Excel 檔案批次建立文章任務</p>
        </div>
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>上傳 Excel 檔案</CardTitle>
            <CardDescription>
              支援五欄格式：關鍵字、網站名稱、文章類型、發佈時間、自訂 Slug
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExcelUploadZone onFileUploaded={handleFileUploaded} />
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <>
          <PublishPlanTable
            plans={publishPlans}
            onPlansChange={setPublishPlans}
          />
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setStep('upload')}>
              返回上傳
            </Button>
            <Button onClick={() => setStep('schedule')}>
              下一步：設定排程
            </Button>
          </div>
        </>
      )}

      {step === 'schedule' && (
        <>
          <ScheduleSettings
            config={scheduleConfig}
            plans={publishPlans}
            onConfigChange={setScheduleConfig}
          />
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setStep('preview')}>
              返回
            </Button>
            <Button onClick={handleScheduleNext}>
              下一步：確認執行
            </Button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <Card>
          <CardHeader>
            <CardTitle>確認執行</CardTitle>
            <CardDescription>
              即將建立 {publishPlans.length} 個文章任務
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div>
                <h3 className="font-semibold mb-2">任務數量</h3>
                <p>{publishPlans.length} 個</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">排程模式</h3>
                <p>
                  {scheduleConfig.mode === 'interval'
                    ? `每 ${scheduleConfig.intervalHours} 小時發佈一篇`
                    : '依指定時間發佈'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setStep('schedule')}>
                返回
              </Button>
              <Button onClick={handleConfirm}>
                確認執行
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
