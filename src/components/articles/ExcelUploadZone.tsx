'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { parseMultiColumnExcel } from '@/lib/utils/excel-parser'
import type { PublishPlan } from '@/app/(dashboard)/dashboard/articles/import/page'

interface ExcelUploadZoneProps {
  onFileUploaded: (plans: PublishPlan[]) => void
}

export function ExcelUploadZone({ onFileUploaded }: ExcelUploadZoneProps) {
  const t = useTranslations('articles')
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
      setError(err instanceof Error ? err.message : t('excelUpload.parseFailed'))
    } finally {
      setIsProcessing(false)
    }
  }, [onFileUploaded, t])

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
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
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
              <p className="text-sm text-muted-foreground">{t('excelUpload.parsing')}</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t('excelUpload.dropOrClick')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('excelUpload.fileFormatInfo')}
                </p>
              </div>
              <Button variant="outline" type="button" disabled={isProcessing}>
                {t('excelUpload.selectFile')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p className="font-medium">{t('excelUpload.formatTitle')}</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>{t('excelUpload.formatKeyword')}</li>
          <li>{t('excelUpload.formatWebsite')}</li>
          <li>{t('excelUpload.formatType')}</li>
          <li>{t('excelUpload.formatTime')}</li>
          <li>{t('excelUpload.formatSlug')}</li>
        </ul>
      </div>
    </div>
  )
}
