'use client'

import { CheckCircle2, Clock, Loader2, XCircle, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ArticleStatusBadgeProps {
  status: string
  scheduledAt?: string | null
}

export function ArticleStatusBadge({ status, scheduledAt }: ArticleStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: '已完成',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 hover:bg-green-100',
        }
      case 'scheduled':
        return {
          icon: <Calendar className="h-3 w-3" />,
          label: scheduledAt
            ? `排程: ${new Date(scheduledAt).toLocaleString('zh-TW', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : '已排程',
          variant: 'secondary' as const,
          className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
        }
      case 'processing':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          label: '處理中',
          variant: 'secondary' as const,
          className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
        }
      case 'pending':
        return {
          icon: <Clock className="h-3 w-3" />,
          label: '等待中',
          variant: 'outline' as const,
          className: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
        }
      case 'failed':
        return {
          icon: <XCircle className="h-3 w-3" />,
          label: '失敗',
          variant: 'destructive' as const,
          className: '',
        }
      default:
        return {
          icon: <Clock className="h-3 w-3" />,
          label: status,
          variant: 'outline' as const,
          className: '',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
      {config.icon}
      <span className="text-xs">{config.label}</span>
    </Badge>
  )
}
