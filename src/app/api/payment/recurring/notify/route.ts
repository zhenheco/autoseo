import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
    const period = formData.get('Period') as string

    console.log('[API Recurring Notify] 收到定期定額通知:', {
      hasPeriod: !!period,
      timestamp: new Date().toISOString()
    })

    if (!period) {
      console.error('[API Recurring Notify] 缺少必要參數')
      return new Response('Status=FAILED&Message=' + encodeURIComponent('缺少必要參數'), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    const paymentService = PaymentService.createInstance(supabase)

    const result = await paymentService.handleRecurringCallback(period)

    if (result.success) {
      console.log('[API Recurring Notify] 處理成功，回應 SUCCESS')
      return new Response('Status=SUCCESS', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    } else {
      console.error('[API Recurring Notify] 處理失敗:', result.error)
      return new Response('Status=FAILED&Message=' + encodeURIComponent(result.error || '處理失敗'), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }
  } catch (error) {
    console.error('[API Recurring Notify] 處理定期定額通知失敗:', error)
    const errorMessage = error instanceof Error ? error.message : '處理定期定額通知失敗'
    return new Response('Status=FAILED&Message=' + encodeURIComponent(errorMessage), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}
