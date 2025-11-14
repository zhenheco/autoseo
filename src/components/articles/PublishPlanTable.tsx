'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, AlertTriangle, XCircle, Pencil, Trash2 } from 'lucide-react'
import type { PublishPlan } from '@/app/(dashboard)/dashboard/articles/import/page'

interface PublishPlanTableProps {
  plans: PublishPlan[]
  onPlansChange: (plans: PublishPlan[]) => void
}

export function PublishPlanTable({ plans, onPlansChange }: PublishPlanTableProps) {
  const [validatedPlans, setValidatedPlans] = useState<PublishPlan[]>([])
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    validatePlans()
  }, [plans])

  const validatePlans = async () => {
    setIsValidating(true)

    try {
      const response = await fetch('/api/websites')
      if (!response.ok) throw new Error('無法載入網站列表')

      const websites = await response.json()

      const validated = plans.map(plan => {
        const match = websites.find((w: { name: string; id: string }) =>
          w.name.toLowerCase() === plan.websiteName.toLowerCase()
        )

        if (match) {
          return {
            ...plan,
            websiteId: match.id,
            status: 'valid' as const
          }
        } else {
          return {
            ...plan,
            status: 'error' as const,
            errorMessage: '找不到對應的網站'
          }
        }
      })

      setValidatedPlans(validated)
      onPlansChange(validated)
    } catch (error) {
      console.error('驗證失敗:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const handleDelete = (planId: string) => {
    const updated = validatedPlans.filter(p => p.id !== planId)
    setValidatedPlans(updated)
    onPlansChange(updated)
  }

  const getStatusIcon = (status: PublishPlan['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusBadge = (status: PublishPlan['status']) => {
    switch (status) {
      case 'valid':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">有效</Badge>
      case 'warning':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">警告</Badge>
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">錯誤</Badge>
    }
  }

  const validCount = validatedPlans.filter(p => p.status === 'valid').length
  const errorCount = validatedPlans.filter(p => p.status === 'error').length

  return (
    <Card>
      <CardHeader>
        <CardTitle>發佈計畫列表</CardTitle>
        <CardDescription>
          共 {validatedPlans.length} 個計畫 | 有效: {validCount} | 錯誤: {errorCount}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">狀態</TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>關鍵字</TableHead>
                <TableHead>網站</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>發佈時間</TableHead>
                <TableHead>自訂 Slug</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isValidating ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    驗證中...
                  </TableCell>
                </TableRow>
              ) : validatedPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    尚未匯入任何資料
                  </TableCell>
                </TableRow>
              ) : (
                validatedPlans.map((plan, index) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getStatusIcon(plan.status)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="max-w-xs truncate">{plan.keyword}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {plan.websiteName}
                        {plan.status === 'error' && (
                          <span className="text-xs text-red-600">({plan.errorMessage})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.articleType ? (
                        <Badge variant="secondary">{plan.articleType}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">AI 判斷</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {plan.publishTime || <span className="text-muted-foreground">依排程</span>}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {plan.customSlug || <span className="text-muted-foreground">自動生成</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
