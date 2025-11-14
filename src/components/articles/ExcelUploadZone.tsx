'use client'

import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { parseMultiColumnExcel } from '@/lib/utils/excel-parser'
import type { PublishPlan } from '@/app/(dashboard)/dashboard/articles/import/page'

interface ExcelUploadZoneProps {
  onFileUploaded: (plans: PublishPlan[]) => void
}

export function ExcelUploadZone({ onFileUploaded }: ExcelUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setIsProcessing(true)

    try {
      const plans = await parseMultiColumnExcel(file)
      onFileUploaded(plans)
    } catch (err) {
      setError(err instanceof Error ? err.message : '檔案解析失敗')
    } finally {
      setIsProcessing(false)
    }
  }, [onFileUploaded])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-12
          transition-colors duration-200
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          {isProcessing ? (
            <>
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground animate-pulse" />
              <p className="text-sm text-muted-foreground">解析中...</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  拖放 Excel 檔案到此處，或點擊選擇檔案
                </p>
                <p className="text-xs text-muted-foreground">
                  支援 .xlsx 和 .xls 格式，最大 5MB，最多 500 個關鍵字
                </p>
              </div>
              <Button variant="outline" type="button" disabled={isProcessing}>
                選擇檔案
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p className="font-medium">Excel 檔案格式說明：</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>第一欄：關鍵字（必填）</li>
          <li>第二欄：網站名稱（必填）</li>
          <li>第三欄：文章類型（選填：教學/排行榜/比較/資訊型）</li>
          <li>第四欄：發佈時間（選填：YYYY-MM-DD HH:MM 格式）</li>
          <li>第五欄：自訂 Slug（選填：SEO 友善的 URL 路徑）</li>
        </ul>
      </div>
    </div>
  )
}
