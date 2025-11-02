import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
    const tradeInfo = formData.get('TradeInfo') as string
    const tradeSha = formData.get('TradeSha') as string

    console.log('[API Notify] 收到付款通知:', {
      hasTradeInfo: !!tradeInfo,
      hasTradeSha: !!tradeSha,
      timestamp: new Date().toISOString()
    })

    if (!tradeInfo || !tradeSha) {
      console.error('[API Notify] 缺少必要參數')
      return new Response('Status=FAILED&Message=' + encodeURIComponent('缺少必要參數'), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    const paymentService = PaymentService.createInstance(supabase)

    const result = await paymentService.handleOnetimeCallback(tradeInfo, tradeSha)

    if (result.success) {
      console.log('[API Notify] 處理成功，回應 SUCCESS')
      return new Response('Status=SUCCESS', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    } else {
      console.error('[API Notify] 處理失敗:', result.error)
      return new Response('Status=FAILED&Message=' + encodeURIComponent(result.error || '處理失敗'), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }
  } catch (error) {
    console.error('[API Notify] 處理支付通知失敗:', error)
    const errorMessage = error instanceof Error ? error.message : '處理支付通知失敗'
    return new Response('Status=FAILED&Message=' + encodeURIComponent(errorMessage), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}
