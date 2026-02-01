'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { Database } from '@/types/database.types'
import { useTranslations } from 'next-intl'

type PaymentOrder = Database['public']['Tables']['payment_orders']['Row']

interface PaymentHistoryProps {
  orders: PaymentOrder[]
}

export function PaymentHistory({ orders }: PaymentHistoryProps) {
  const t = useTranslations('billing.paymentHistory')

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-xl">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    order.status === 'success' ? 'bg-green-500/10' :
                    order.status === 'pending' ? 'bg-yellow-500/10' :
                    'bg-red-500/10'
                  }`}>
                    {order.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : order.status === 'pending' ? (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{order.item_description || t('order')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('orderNumber')}{order.order_no}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.created_at && new Date(order.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">NT$ {order.amount.toLocaleString()}</p>
                  <p className={`text-sm ${
                    order.status === 'success' ? 'text-green-500' :
                    order.status === 'pending' ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {order.status === 'success' ? t('statusSuccess') :
                     order.status === 'pending' ? t('statusPending') :
                     order.status === 'failed' ? t('statusFailed') :
                     order.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">{t('noRecords')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
