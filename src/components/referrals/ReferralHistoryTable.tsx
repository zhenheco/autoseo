'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

interface ReferralHistoryTableProps {
  referrals: Array<{
    id: string
    referred_company_id: string
    status: 'pending' | 'completed' | 'expired'
    created_at: string
    completed_at?: string | null
    referred_company?: {
      name: string
    } | null
  }>
}

export function ReferralHistoryTable({ referrals }: ReferralHistoryTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-success/10 text-success hover:bg-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            已完成
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400">
            <Clock className="h-3 w-3 mr-1" />
            待付款
          </Badge>
        )
      case 'expired':
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            已過期
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>推薦對象</TableHead>
            <TableHead>註冊時間</TableHead>
            <TableHead>完成時間</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead className="text-right">獎勵</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referrals.map((referral) => (
            <TableRow key={referral.id}>
              <TableCell className="font-medium">
                {referral.referred_company?.name || '未命名公司'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(referral.created_at)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {referral.completed_at ? formatDate(referral.completed_at) : '-'}
              </TableCell>
              <TableCell>{getStatusBadge(referral.status)}</TableCell>
              <TableCell className="text-right">
                {referral.status === 'completed' ? (
                  <span className="font-semibold text-success">+50,000</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
