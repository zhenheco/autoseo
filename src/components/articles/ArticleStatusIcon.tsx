'use client'

import { Check, Clock, XCircle, Calendar, Loader2, Circle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ArticleStatusIconProps {
  status: string
  scheduledAt?: string | null
  wordpressStatus?: string | null
  publishedToWebsiteName?: string | null
  wordpressUrl?: string | null
}

export function ArticleStatusIcon({
  status,
  scheduledAt,
  wordpressStatus,
  publishedToWebsiteName,
  wordpressUrl
}: ArticleStatusIconProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'published':
        const publishInfo = publishedToWebsiteName
          ? `已發佈到 ${publishedToWebsiteName}${wordpressStatus === 'publish' ? '' : ' (草稿)'}`
          : '已發佈'
        return {
          icon: Circle,
          label: publishInfo,
          iconClassName: 'text-red-600 dark:text-red-400 fill-current',
          url: wordpressUrl,
        }
      case 'completed':
      case 'generated':
      case 'reviewed':
        return {
          icon: Check,
          label: '已完成',
          iconClassName: 'text-green-600 dark:text-green-400',
        }
      case 'scheduled':
        return {
          icon: Calendar,
          label: scheduledAt
            ? `排程: ${new Date(scheduledAt).toLocaleString('zh-TW', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : '已排程',
          iconClassName: 'text-blue-600 dark:text-blue-400',
        }
      case 'processing':
        return {
          icon: Loader2,
          label: '處理中',
          iconClassName: 'text-yellow-600 dark:text-yellow-400 animate-spin',
        }
      case 'pending':
        return {
          icon: Clock,
          label: '等待中',
          iconClassName: 'text-gray-600 dark:text-gray-400',
        }
      case 'failed':
        return {
          icon: XCircle,
          label: '失敗',
          iconClassName: 'text-red-600 dark:text-red-400',
        }
      default:
        return {
          icon: Clock,
          label: status,
          iconClassName: 'text-gray-600 dark:text-gray-400',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            role="img"
            aria-label={config.label}
            tabIndex={0}
            className="inline-flex items-center justify-center cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.currentTarget.click()
              }
            }}
          >
            <Icon className={`h-4 w-4 ${config.iconClassName}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent role="tooltip">
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
